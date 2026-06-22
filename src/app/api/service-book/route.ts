// src/app/api/service-book/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resend } from '@/lib/resendClient'
import { sendPushNotificationsToTenant } from '@/lib/sendPushNotifications'
function timeStrToMinutes(s: string): number {
  const parts = String(s || '').split(':')
  const h = parseInt(parts[0] || '0', 10)
  const m = parseInt(parts[1] || '0', 10)
  return h * 60 + m
}
function escapeHtml(value: string) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
export async function POST(req: Request) {
  try {
    const body = await req.json()

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
    if (!customer_name || customer_name.trim().length < 2) {
      return NextResponse.json({ error: 'Nome non valido.' }, { status: 400 })
    }
    const cleanPhone = String(customer_phone || '').trim()
const cleanEmail = customer_email.trim()

if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 8) {
  return NextResponse.json({ error: 'Telefono non valido.' }, { status: 400 })
}

if (!cleanEmail) {
  return NextResponse.json(
    { error: 'Email obbligatoria.' },
    { status: 400 },
  )
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
  return NextResponse.json(
    { error: 'Email non valida.' },
    { status: 400 },
  )
}
    // 1) leggo settings
const { data: st, error: stErr } = await supabaseAdmin
  .from('tenant_settings')
  .select('staff_assign_mode, staff_rr_cursor, lead_minutes')
  .eq('tenant_id', tenant_id)
  .maybeSingle()

    if (stErr) throw stErr

    const staff_assign_mode = (st?.staff_assign_mode || 'first_free') as
      | 'first_free'
      | 'round_robin'

    const rr_cursor = Number(st?.staff_rr_cursor || 0)
const leadMinutes =
  typeof st?.lead_minutes === 'number' && st.lead_minutes >= 0
    ? st.lead_minutes
    : 30

// blocco prenotazioni nel passato o troppo vicine
const now = new Date()
const todayStr = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
].join('-')

const nowMinutes = now.getHours() * 60 + now.getMinutes()
const bookingMinutes = timeStrToMinutes(booking_time)

// data nel passato
if (booking_date < todayStr) {
  return NextResponse.json(
    { error: 'Non puoi prenotare in una data passata.' },
    { status: 400 },
  )
}

// oggi: blocca orari già passati o troppo vicini
if (booking_date === todayStr && bookingMinutes < nowMinutes + leadMinutes) {
  return NextResponse.json(
    { error: 'Questo orario non è più prenotabile.' },
    { status: 400 },
  )
}
    // 2) durata servizio
    const { data: svc, error: svcErr } = await supabaseAdmin
  .from('services')
  .select('name, duration_minutes, price_cents')
  .eq('tenant_id', tenant_id)
  .eq('id', service_id)
  .maybeSingle()

    if (svcErr) throw svcErr
    const duration = Number(svc?.duration_minutes || 60)

    // 3) staff attivo
    const { data: staffRows, error: staffErr } = await supabaseAdmin
      .from('staff_members')
      .select('id, position')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (staffErr) throw staffErr
    const staff = staffRows || []

    if (!staff.length) {
      return NextResponse.json({ error: 'Nessun operatore attivo configurato.' }, { status: 400 })
    }

    // se il cliente ha scelto un operatore specifico, lo validiamo
    if (requested_staff_id) {
      const ok = staff.some(s => s.id === requested_staff_id)
      if (!ok) {
        return NextResponse.json({ error: 'Operatore non valido o non attivo.' }, { status: 400 })
      }
    }

    // 4) prendo tutte le prenotazioni di quel giorno (per calcolare overlap per operatore)
    // NB: consideriamo solo prenotazioni non cancellate
    const { data: dayBookings, error: bErr } = await supabaseAdmin
      .from('service_bookings')
      .select('staff_id, booking_time, service_id, status')
      .eq('tenant_id', tenant_id)
      .eq('booking_date', booking_date)
      .neq('status', 'cancelled')

    if (bErr) throw bErr

    // mappa durata per service_id presenti quel giorno
    const serviceIds = Array.from(new Set((dayBookings || []).map(b => b.service_id).filter(Boolean)))
    const { data: svcsDur, error: sdErr } = await supabaseAdmin
      .from('services')
      .select('id, duration_minutes')
      .eq('tenant_id', tenant_id)
      .in('id', serviceIds)

    if (sdErr) throw sdErr
    const durMap: Record<string, number> = {}
    ;(svcsDur || []).forEach(s => (durMap[s.id] = Number(s.duration_minutes || 60)))

    const candidateStart = timeStrToMinutes(booking_time)
    const candidateEnd = candidateStart + duration

    function isStaffFree(staffId: string) {
      // se ci sono vecchie prenotazioni con staff_id null,
      // NON le usiamo per bloccare un operatore specifico.
      // (da qui in poi le nuove verranno sempre assegnate).
      const list = (dayBookings || []).filter(b => b.staff_id === staffId)

      for (const b of list) {
        const start = timeStrToMinutes(String(b.booking_time || '00:00'))
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
        await supabaseAdmin
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

    // 6) insert booking (sempre con staff_id assegnato)
    const { data: inserted, error: insErr } = await supabaseAdmin
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
      })
      .select('id, staff_id')
      .single()

    if (insErr) throw insErr

// 7) Invio email conferma cliente.
// Questo endpoint gestisce solo prenotazioni con pagamento in salone.
// L'email NON deve bloccare la prenotazione: se fallisce, la prenotazione resta valida.
if (cleanEmail) {
try {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', tenant_id)
    .maybeSingle()

  const { data: staffMember } = final_staff_id
    ? await supabaseAdmin
        .from('staff_members')
        .select('name')
        .eq('id', final_staff_id)
        .maybeSingle()
    : { data: null }

  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  const businessName = tenant?.name || 'Slotta'
  const serviceName = svc?.name || 'Servizio'
  const staffName = staffMember?.name || 'Assegnazione automatica'
  const price =
    typeof svc?.price_cents === 'number'
      ? `€ ${(svc.price_cents / 100).toFixed(2)}`
      : '-'

  await resend.emails.send({
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
            <strong>Data:</strong> ${escapeHtml(booking_date)}
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

        <p style="margin-top: 22px; font-size: 12px; color: #94a3b8;">
          Email inviata automaticamente da Slotta.
        </p>
      </div>
    `,
  })
} catch (emailErr) {
  console.error('Errore invio email conferma cliente:', emailErr)
}
}
// 8) Invio notifica push al gestore
// La push NON deve bloccare la prenotazione: se fallisce, la prenotazione resta valida.
try {
  const { count: pendingCount } = await supabaseAdmin
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
} catch (pushErr) {
  console.error('Errore invio notifiche push:', pushErr)
}

return NextResponse.json({ booking_id: inserted.id, staff_id: inserted.staff_id })
  } catch (e: unknown) {
    // Generate a simple request ID to help trace errors in logs
    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(Date.now())

    // Log the raw error for debugging purposes; avoid reading arbitrary properties from unknown
    console.error('service-book error', e)

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
