// src/app/api/service-checkout/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  bookingTimeToMinutes,
  getNowInTimeZone,
  hasValidBookingCustomer,
  isValidBookingDate,
  isUuid,
} from '@/lib/bookingRequest'
import { enforceDistributedRateLimit, readJsonBody } from '@/lib/apiGuard'
import {
  isStaffOverlapError,
  staffBusyResponseBody,
} from '@/lib/bookingConflict'
import { createHoldCancelToken } from '@/lib/holdCancelToken'

const stripeSecret = process.env.STRIPE_SECRET_KEY

function isSafeLocalUrl(value: string, origin: string) {
  try {
    const parsed = new URL(value)
    return parsed.origin === origin
  } catch {
    return false
  }
}

function hasOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && aEnd > bStart
}

type BusyRow = {
  staff_id: string | null
  service_id: string | null
  booking_time: string | null
}

export async function POST(req: Request) {
  let createdHoldId: string | null = null

  try {
    if (!stripeSecret) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY mancante' },
        { status: 500 },
      )
    }

    const stripe = new Stripe(stripeSecret)

    const limited = await enforceDistributedRateLimit(req, 'service-checkout', 10, 60_000)
    if (limited) return limited
    const body = await readJsonBody(req)
    if (!body) return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })

    const tenant_id = String(body.tenant_id || '')
    const service_id = String(body.service_id || '')
    const booking_date = String(body.booking_date || '')
    const booking_time = String(body.booking_time || '')
    const customer_name = String(body.customer_name || '')
    const customer_email = String(body.customer_email || '').trim()
    const customer_phone = String(body.customer_phone || '').trim()
    const note = body.note ? String(body.note) : null

    const requested_staff_id =
      body.staff_id === null ||
      body.staff_id === undefined ||
      body.staff_id === 'any'
        ? null
        : String(body.staff_id)

    const success_url = String(body.success_url || '')
    const cancel_url = String(body.cancel_url || '')

    const origin = new URL(req.url).origin

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

    if (!hasValidBookingCustomer({ name: customer_name, email: customer_email, phone: customer_phone, note })) {
      return NextResponse.json({ error: 'Dati cliente non validi o troppo lunghi.' }, { status: 400 })
    }
    if (!success_url || !cancel_url) {
      return NextResponse.json(
        { error: 'URL di ritorno mancanti.' },
        { status: 400 },
      )
    }

    if (!isSafeLocalUrl(success_url, origin) || !isSafeLocalUrl(cancel_url, origin)) {
      return NextResponse.json(
        { error: 'URL di ritorno non validi.' },
        { status: 400 },
      )
    }

        // Controllo Stripe Connect del salone
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .select(
        `
        id,
        stripe_connect_account_id,
        stripe_connect_charges_enabled,
        stripe_connect_payouts_enabled
      `,
      )
      .eq('id', tenant_id)
      .maybeSingle()

    if (tenantErr) throw tenantErr

    if (!tenant) {
      return NextResponse.json(
        { error: 'Attività non trovata.' },
        { status: 404 },
      )
    }

    const stripeAccountId = tenant.stripe_connect_account_id as string | null

    if (
      !stripeAccountId ||
      !tenant.stripe_connect_charges_enabled ||
      !tenant.stripe_connect_payouts_enabled
    ) {
      return NextResponse.json(
        {
          error:
            'I pagamenti online non sono ancora attivi per questa attività. Scegli il pagamento in salone oppure contatta il salone.',
        },
        { status: 400 },
      )
    }

  
    // 1. Settings tenant
    const { data: st, error: stErr } = await supabaseAdmin
      .from('tenant_settings')
      .select('staff_assign_mode, staff_rr_cursor, lead_minutes, timezone')
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

    // 2. Blocca date/orari passati o troppo vicini
    const { date: todayStr, minutes: nowMinutes } = getNowInTimeZone(
      st?.timezone || 'Europe/Rome',
    )

    if (booking_date < todayStr) {
      return NextResponse.json(
        { error: 'Non puoi prenotare in una data passata.' },
        { status: 400 },
      )
    }

    if (booking_date === todayStr && bookingMinutes < nowMinutes + leadMinutes) {
      return NextResponse.json(
        { error: 'Questo orario non è più prenotabile.' },
        { status: 400 },
      )
    }

    // 3. Servizio
    const { data: svc, error: svcErr } = await supabaseAdmin
      .from('services')
      .select('id, name, duration_minutes, price_cents')
      .eq('tenant_id', tenant_id)
      .eq('id', service_id)
      .eq('is_active', true)
      .maybeSingle()

    if (svcErr) throw svcErr

    if (!svc) {
      return NextResponse.json(
        { error: 'Servizio non trovato.' },
        { status: 404 },
      )
    }

    const duration = Number(svc.duration_minutes || 60)
    const priceCents = Number(svc.price_cents || 0)

    if (!priceCents || priceCents <= 0) {
      return NextResponse.json(
        { error: 'Il servizio non ha un prezzo valido per il pagamento online.' },
        { status: 400 },
      )
    }

    // 4. Staff attivo
    const { data: staffRows, error: staffErr } = await supabaseAdmin
      .from('staff_members')
      .select('id, position')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (staffErr) throw staffErr

    const staff = staffRows || []

    if (!staff.length) {
      return NextResponse.json(
        { error: 'Nessun operatore attivo configurato.' },
        { status: 400 },
      )
    }

    if (requested_staff_id) {
      const ok = staff.some(s => s.id === requested_staff_id)

      if (!ok) {
        return NextResponse.json(
          { error: 'Operatore non valido o non attivo.' },
          { status: 400 },
        )
      }
    }

    // 5. Prenotazioni reali del giorno
   const { data: dayBookings, error: bErr } = await supabaseAdmin
  .from('service_bookings')
  .select('staff_id, booking_time, service_id, status, checkout_pending')
  .eq('tenant_id', tenant_id)
  .eq('booking_date', booking_date)
  .neq('status', 'cancelled')
  .or('checkout_pending.is.null,checkout_pending.eq.false')
    if (bErr) throw bErr
// Pulizia automatica hold scaduti.
// Così eventuali tentativi Stripe abbandonati non bloccano più gli slot.
// Se la pulizia fallisce, non blocchiamo il checkout: logghiamo e proseguiamo.
try {
  const { error: cleanupHoldsErr } = await supabaseAdmin
    .from('service_booking_holds')
    .update({ status: 'expired' })
    .eq('tenant_id', tenant_id)
    .eq('status', 'pending')
    .lte('expires_at', new Date().toISOString())

  if (cleanupHoldsErr) {
    console.warn('Errore pulizia hold scaduti:', cleanupHoldsErr.message)
  }
} catch (cleanupHoldsErr) {
  console.warn('Errore pulizia hold scaduti:', cleanupHoldsErr)
}
    // 6. Hold Stripe attivi del giorno
    const { data: activeHolds, error: hErr } = await supabaseAdmin
      .from('service_booking_holds')
      .select('staff_id, booking_time, service_id, status, expires_at')
      .eq('tenant_id', tenant_id)
      .eq('booking_date', booking_date)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())

    if (hErr) throw hErr

    const realBusyRows = (dayBookings || []) as BusyRow[]
    const holdBusyRows = (activeHolds || []) as BusyRow[]
    const allBusyRows = [...realBusyRows, ...holdBusyRows]

    const serviceIds = Array.from(
      new Set(
        [
          service_id,
          ...allBusyRows
            .map(row => row.service_id)
            .filter((id): id is string => Boolean(id)),
        ],
      ),
    )

    const { data: svcsDur, error: sdErr } = await supabaseAdmin
      .from('services')
      .select('id, duration_minutes')
      .eq('tenant_id', tenant_id)
      .in('id', serviceIds)

    if (sdErr) throw sdErr

    const durMap: Record<string, number> = {}

    ;(svcsDur || []).forEach(s => {
      durMap[s.id] = Number(s.duration_minutes || 60)
    })

    const candidateStart = bookingMinutes
    const candidateEnd = candidateStart + duration

    function isStaffFree(staffId: string) {
      const list = allBusyRows.filter(row => row.staff_id === staffId)

      for (const row of list) {
        const start = bookingTimeToMinutes(String(row.booking_time || '')) ?? 0
        const rowDuration = row.service_id ? durMap[row.service_id] || 60 : 60
        const end = start + rowDuration

        if (hasOverlap(candidateStart, candidateEnd, start, end)) {
          return false
        }
      }

      return true
    }

    // 7. Assegna operatore temporaneo
    let final_staff_id: string | null = requested_staff_id

    if (!final_staff_id) {
      const ordered = staff.map(s => s.id)

      if (staff_assign_mode === 'round_robin') {
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
          return NextResponse.json(
            { error: 'Nessun operatore disponibile in questo orario.' },
            { status: 409 },
          )
        }

        final_staff_id = picked

        await supabaseAdmin
          .from('tenant_settings')
          .upsert(
            { tenant_id, staff_rr_cursor: rr_cursor + 1 },
            { onConflict: 'tenant_id' },
          )
      } else {
        const picked = ordered.find(id => isStaffFree(id)) || null

        if (!picked) {
          return NextResponse.json(
            { error: 'Nessun operatore disponibile in questo orario.' },
            { status: 409 },
          )
        }

        final_staff_id = picked
      }
    } else {
      if (!isStaffFree(final_staff_id)) {
        return NextResponse.json(
          {
            error_code: 'STAFF_BUSY',
            error: 'Operatore già occupato in questo orario.',
          },
          { status: 409 },
        )
      }
    }

    // 8. Crea hold temporaneo.
    // Lo slot resta riservato mentre il cliente è su Stripe.
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

    const { data: hold, error: holdErr } = await supabaseAdmin
      .from('service_booking_holds')
      .insert({
        tenant_id,
        service_id,
        staff_id: final_staff_id,

        customer_name: customer_name.trim(),
        customer_email: customer_email || null,
        customer_phone,
        note,

        booking_date,
        booking_time,

        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single()

    if (holdErr) throw holdErr

    createdHoldId = hold.id

    const holdCancelToken = createHoldCancelToken(
      hold.id,
      expiresAt,
      stripeSecret,
    )

    // 9. Cancel URL sicuro: se il cliente annulla, marchiamo l'hold come cancelled.
    const safeCancelUrl = new URL('/api/service-checkout-cancel', origin)
    safeCancelUrl.searchParams.set('hold_id', hold.id)
    safeCancelUrl.searchParams.set('cancel_token', holdCancelToken)
    safeCancelUrl.searchParams.set('redirect_to', cancel_url)

    // 10. Stripe Checkout
    // La sessione viene creata sull'account Stripe collegato del salone.
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        success_url,
        cancel_url: safeCancelUrl.toString(),
        customer_email: customer_email || undefined,

        // Stripe richiede expires_at in secondi Unix.
        expires_at: Math.floor(expiresAt.getTime() / 1000),

        metadata: {
          hold_id: hold.id,
          tenant_id,
          service_id,
          stripe_connect_account_id: stripeAccountId,
        },

        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: priceCents,
              product_data: {
                name: svc.name || 'Servizio',
              },
            },
          },
        ],
      },
      {
        stripeAccount: stripeAccountId,
      },
    )

    const { error: updateHoldErr } = await supabaseAdmin
      .from('service_booking_holds')
      .update({
        stripe_session_id: session.id,
      })
      .eq('id', hold.id)
      .eq('tenant_id', tenant_id)

    if (updateHoldErr) throw updateHoldErr

    return NextResponse.json({
      url: session.url,
      hold_id: hold.id,
      hold_cancel_token: holdCancelToken,
      stripe_session_id: session.id,
    })
  } catch (e: unknown) {
    if (createdHoldId) {
      await supabaseAdmin
        .from('service_booking_holds')
        .update({ status: 'cancelled' })
        .eq('id', createdHoldId)
        .eq('status', 'pending')
    }

    if (isStaffOverlapError(e)) {
      return NextResponse.json(staffBusyResponseBody(), { status: 409 })
    }

    console.error('service-checkout error:', e)

    const message =
      e instanceof Error
        ? e.message
        : 'Errore durante la creazione del pagamento'

    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
