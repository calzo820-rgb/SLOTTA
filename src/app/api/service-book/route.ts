// src/app/api/service-book/route.ts
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { sendPushNotificationsToTenant } from '@/lib/sendPushNotifications'
import {
  bookingTimeToMinutes,
  hasValidBookingCustomer,
  isValidBookingDate,
  isUuid,
} from '@/lib/bookingRequest'
import { enforceDistributedRateLimit, readJsonBody } from '@/lib/apiGuard'
import {
  isStaffOverlapError,
  staffBusyResponseBody,
} from '@/lib/bookingConflict'
import {
  BookingAvailabilityError,
  loadBookingAvailability,
} from '@/lib/serverBookingAvailability'
import {
  bookingConfirmationExpiry,
  createBookingConfirmationToken,
  hashBookingConfirmationToken,
} from '@/lib/bookingConfirmationToken'
import { logApiEvent, observeApiRoute } from '@/lib/apiObservability'
import { sendTransactionalEmail } from '@/lib/transactionalEmail'
import { formatBookingDate } from '@/lib/bookingDisplay'
import {
  bookingManagementExpiry,
  buildBookingManagementUrl,
  createBookingManagementToken,
  hashBookingManagementToken,
} from '@/lib/bookingManagement'
function escapeHtml(value: string) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
async function handlePost(req: Request) {
  try {
    const limited = await enforceDistributedRateLimit(req, 'service-book', 10, 60_000)
    if (limited) return limited
    const body = await readJsonBody(req)
    if (!body) return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })

    const tenant_id = String(body.tenant_id || '')
    const service_id = String(body.service_id || '')
    const booking_date = String(body.booking_date || '') // YYYY-MM-DD
    const booking_time = String(body.booking_time || '') // HH:MM
    const customer_name = String(body.customer_name || '')
    const customer_email = String(body.customer_email || '')
    const customer_phone = body.customer_phone ? String(body.customer_phone) : null
    const note = body.note ? String(body.note) : null
if (body.payment_mode === 'online') {
  return NextResponse.json(
    {
      error: 'Il pagamento online deve passare da /api/service-checkout.',
    },
    { status: 400 },
  )
}

// Note: the payment mode is implicitly in person for this endpoint. Online
// payments are handled via /api/service-checkout, so no local variable is
// required here.

    // staff_id: null = ANY
    const requested_staff_id =
      body.staff_id === null || body.staff_id === undefined || body.staff_id === 'any'
        ? null
        : String(body.staff_id)

    if (!tenant_id || !service_id || !booking_date || !booking_time) {
      return NextResponse.json({ error: 'Dati mancanti.' }, { status: 400 })
    }
    if (!isUuid(tenant_id) || !isUuid(service_id) || (requested_staff_id && !isUuid(requested_staff_id))) {
      return NextResponse.json({ error: 'Identificativi non validi.' }, { status: 400 })
    }
    const bookingMinutes = bookingTimeToMinutes(booking_time)
    if (!isValidBookingDate(booking_date) || bookingMinutes === null) {
      return NextResponse.json({ error: 'Data o orario non validi.' }, { status: 400 })
    }
    const cleanPhone = String(customer_phone || '').trim()
const cleanEmail = customer_email.trim()
if (!hasValidBookingCustomer({ name: customer_name, email: cleanEmail, phone: cleanPhone, note })) {
  return NextResponse.json({ error: 'Dati cliente non validi o troppo lunghi.' }, { status: 400 })
}
    const availability = await loadBookingAvailability({
      tenantId: tenant_id,
      serviceId: service_id,
      bookingDate: booking_date,
      bookingMinutes,
      requestedStaffId: requested_staff_id,
    })
    const svc = availability.service
    const staff = availability.staff
    const duration = availability.duration
    const staff_assign_mode = availability.settings.staffAssignMode
    const rr_cursor = availability.settings.roundRobinCursor

    // 4) prendo tutte le prenotazioni di quel giorno (per calcolare overlap per operatore)
    // NB: consideriamo solo prenotazioni non cancellate
    const { data: dayBookings, error: bErr } = await getSupabaseAdmin()
      .from('service_bookings')
      .select('staff_id, booking_time, service_id, status')
      .eq('tenant_id', tenant_id)
      .eq('booking_date', booking_date)
      .neq('status', 'cancelled')

    if (bErr) throw bErr

    // mappa durata per service_id presenti quel giorno
    const serviceIds = Array.from(new Set((dayBookings || []).map(b => b.service_id).filter(Boolean)))
    const { data: svcsDur, error: sdErr } = await getSupabaseAdmin()
      .from('services')
      .select('id, duration_minutes')
      .eq('tenant_id', tenant_id)
      .in('id', serviceIds)

    if (sdErr) throw sdErr
    const durMap: Record<string, number> = {}
    ;(svcsDur || []).forEach(s => (durMap[s.id] = Number(s.duration_minutes || 60)))

    const candidateStart = bookingMinutes
    const candidateEnd = candidateStart + duration

    function isStaffFree(staffId: string) {
      // se ci sono vecchie prenotazioni con staff_id null,
      // NON le usiamo per bloccare un operatore specifico.
      // (da qui in poi le nuove verranno sempre assegnate).
      const list = (dayBookings || []).filter(b => b.staff_id === staffId)

      for (const b of list) {
        const start = bookingTimeToMinutes(String(b.booking_time || '')) ?? 0
        const bDur = durMap[String(b.service_id)] || 60
        const end = start + bDur

        // overlap
        if (candidateStart < end && candidateEnd > start) return false
      }
      return true
    }

    // 5) scegli staff finale
    let final_staff_id: string | null = requested_staff_id

    if (!final_staff_id) {
      // ANY -> assign
      const ordered = staff.map(s => s.id)

      if (staff_assign_mode === 'round_robin') {
        // start index dal cursor
        const n = ordered.length
        const startIdx = ((rr_cursor % n) + n) % n

        let picked: string | null = null
        for (let i = 0; i < n; i++) {
          const id = ordered[(startIdx + i) % n]
          if (isStaffFree(id)) {
            picked = id
            break
          }
        }

        if (!picked) {
          return NextResponse.json({ error: 'Nessun operatore disponibile in questo orario.' }, { status: 409 })
        }

        final_staff_id = picked

        // aggiorno cursor (cursor + 1) — onConflict tenant_id
        await getSupabaseAdmin()
          .from('tenant_settings')
          .upsert({ tenant_id, staff_rr_cursor: rr_cursor + 1 }, { onConflict: 'tenant_id' })
      } else {
        // first_free: in ordine position
        const picked = ordered.find(id => isStaffFree(id)) || null
        if (!picked) {
          return NextResponse.json({ error: 'Nessun operatore disponibile in questo orario.' }, { status: 409 })
        }
        final_staff_id = picked
      }
    } else {
// operatore specifico: verifica libero
if (!isStaffFree(final_staff_id)) {
  return NextResponse.json(
    {
      error_code: 'STAFF_BUSY',
      error: 'Operatore già occupato in questo orario.',
    },
    { status: 409 }
  )
}

    }

    const confirmationToken = createBookingConfirmationToken()
    const confirmationExpiresAt = bookingConfirmationExpiry()
    const managementToken = createBookingManagementToken()
    const managementExpiresAt = bookingManagementExpiry(booking_date)

    // 6) insert booking (sempre con staff_id assegnato)
    const { data: inserted, error: insErr } = await getSupabaseAdmin()
      .from('service_bookings')
      .insert({
        tenant_id,
        service_id,
        staff_id: final_staff_id,
       customer_name: customer_name.trim(),
customer_email: cleanEmail || null,
customer_phone: cleanPhone,
        booking_date,
        booking_time,
        note,
        status: 'pending',
        payment_status: 'unpaid',
        checkout_pending: false,
        confirmation_token_hash: hashBookingConfirmationToken(confirmationToken),
        confirmation_token_expires_at: confirmationExpiresAt.toISOString(),
        management_token_hash: hashBookingManagementToken(managementToken),
        management_token_expires_at: managementExpiresAt.toISOString(),
      })
      .select('id, staff_id')
      .single()

    if (insErr) throw insErr

// 7) Invio email conferma cliente.
// Questo endpoint gestisce solo prenotazioni con pagamento in salone.
// L'email NON deve bloccare la prenotazione: se fallisce, la prenotazione resta valida.
if (cleanEmail) {
try {
  const { data: tenant } = await getSupabaseAdmin()
    .from('tenants')
    .select('name, slug')
    .eq('id', tenant_id)
    .maybeSingle()

  const { data: staffMember } = final_staff_id
    ? await getSupabaseAdmin()
        .from('staff_members')
        .select('name')
        .eq('id', final_staff_id)
        .maybeSingle()
    : { data: null }

  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  const businessName = tenant?.name || 'Slotta'
  const managementUrl = buildBookingManagementUrl(
    new URL(req.url).origin,
    tenant?.slug || '',
    managementToken,
  )
  const serviceName = svc?.name || 'Servizio'
  const staffName = staffMember?.name || 'Assegnazione automatica'
  const price =
    typeof svc?.price_cents === 'number'
      ? `€ ${(svc.price_cents / 100).toFixed(2)}`
      : '-'

  await sendTransactionalEmail({
    from,
    to: cleanEmail,
    subject: `Prenotazione ricevuta - ${businessName}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0F1D2D; line-height: 1.5; max-width: 560px; margin: 0 auto;">
        <div style="padding: 20px 0;">
          <h1 style="margin: 0; font-size: 24px; color: #0F1D2D;">
            Prenotazione ricevuta
          </h1>
          <p style="margin: 8px 0 0; color: #64748b;">
            Ciao ${escapeHtml(customer_name)}, abbiamo ricevuto la tua richiesta di prenotazione.
          </p>
        </div>

        <div style="border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px; background: #f8fafc;">
          <p style="margin: 0 0 10px;">
            <strong>Attività:</strong> ${escapeHtml(businessName)}
          </p>
          <p style="margin: 0 0 10px;">
            <strong>Servizio:</strong> ${escapeHtml(serviceName)}
          </p>
          <p style="margin: 0 0 10px;">
            <strong>Data:</strong> ${escapeHtml(formatBookingDate(booking_date))}
          </p>
          <p style="margin: 0 0 10px;">
            <strong>Orario:</strong> ${escapeHtml(booking_time.slice(0, 5))}
          </p>
          <p style="margin: 0 0 10px;">
            <strong>Operatore:</strong> ${escapeHtml(staffName)}
          </p>
          <p style="margin: 0;">
            <strong>Prezzo:</strong> ${escapeHtml(price)}
          </p>
        </div>

        <div style="margin-top: 18px; padding: 16px; border-radius: 16px; background: #FFF7E0; color: #0F1D2D;">
          <strong>Nota:</strong> la prenotazione è stata inviata all’attività. Se necessario, verrai contattato per eventuali conferme o modifiche.
        </div>

        <p style="margin: 22px 0 0;">
          <a href="${escapeHtml(managementUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 14px; background: #0F1D2D; color: #ffffff; text-decoration: none; font-weight: bold;">
            Gestisci o annulla prenotazione
          </a>
        </p>

        <p style="margin-top: 22px; font-size: 12px; color: #94a3b8;">
          Email inviata automaticamente da Slotta.
        </p>
      </div>
    `,
  }, `booking-received-${inserted.id}`)
} catch {
  logApiEvent('booking_confirmation_email_failed', 'error')
}
}
// Email al gestore anche per il pagamento in salone.
try {
  const { data: ownerTenant } = await getSupabaseAdmin()
    .from('tenants')
    .select('name, contact_email')
    .eq('id', tenant_id)
    .maybeSingle()

  if (ownerTenant?.contact_email) {
    await sendTransactionalEmail({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: ownerTenant.contact_email,
      subject: `Nuova richiesta di prenotazione - ${ownerTenant.name || 'Slotta'}`,
      html: `<div style="font-family:Arial,sans-serif;color:#0F1D2D;line-height:1.5">
        <h2>Nuova richiesta di prenotazione</h2>
        <p>È arrivata una nuova richiesta con pagamento in salone.</p>
        <p><strong>Cliente:</strong> ${escapeHtml(customer_name)}</p>
        <p><strong>Telefono:</strong> ${escapeHtml(cleanPhone || 'Non indicato')}</p>
        <p><strong>Email:</strong> ${escapeHtml(cleanEmail || 'Non indicata')}</p>
        <p><strong>Servizio:</strong> ${escapeHtml(svc?.name || 'Servizio')}</p>
        <p><strong>Data:</strong> ${escapeHtml(formatBookingDate(booking_date))}</p>
        <p><strong>Ora:</strong> ${escapeHtml(booking_time.slice(0, 5))}</p>
        <p><strong>Pagamento:</strong> in salone</p>
      </div>`,
    }, `booking-owner-${inserted.id}`)
  }
} catch {
  logApiEvent('booking_owner_email_failed', 'error')
}
// Invio notifica push al gestore
// La push NON deve bloccare la prenotazione: se fallisce, la prenotazione resta valida.
try {
  const { count: pendingCount } = await getSupabaseAdmin()
  .from('service_bookings')
  .select('id', { count: 'exact', head: true })
  .eq('tenant_id', tenant_id)
  .eq('status', 'pending')

await sendPushNotificationsToTenant(tenant_id, {
  title: 'Nuova prenotazione',
  body: `${customer_name} ha richiesto un nuovo appuntamento.`,
  url: '/admin/service-bookings',
  badgeCount: pendingCount ?? 1,
})
} catch {
  logApiEvent('booking_push_notification_failed', 'error')
}

return NextResponse.json({
  booking_id: inserted.id,
  staff_id: inserted.staff_id,
  confirmation_token: confirmationToken,
  management_token: managementToken,
})
  } catch (e: unknown) {
    // Generate a simple request ID to help trace errors in logs
    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(Date.now())

    if (isStaffOverlapError(e)) {
      return NextResponse.json(staffBusyResponseBody(), { status: 409 })
    }
    if (e instanceof BookingAvailabilityError) {
      return NextResponse.json(
        { error_code: e.code, error: e.message },
        { status: e.status },
      )
    }

    // Log the raw error for debugging purposes; avoid reading arbitrary properties from unknown
    logApiEvent('service_booking_failed', 'error')

    return NextResponse.json(
      {
        // Provide a generic error message and include the request ID
        error: 'Errore temporaneo durante la prenotazione. Riprova tra poco.',
        requestId,
      },
      { status: 500 },
    )
  }
}

export const POST = observeApiRoute('/api/service-book', handlePost)
