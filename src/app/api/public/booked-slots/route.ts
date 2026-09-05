// src/app/api/public/booked-slots/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isUuid, isValidBookingDate } from '@/lib/bookingRequest'
import { enforceRateLimit, readJsonBody } from '@/lib/apiGuard'

type BusyRow = {
  service_id: string
  staff_id: string | null
  booking_time: string
  status: string | null
  payment_status?: string | null
  checkout_pending?: boolean | null
  created_at?: string | null
  expires_at?: string | null
}

export async function POST(req: Request) {
  try {
    const limited = enforceRateLimit(req, 'booked-slots', 120, 60_000)
    if (limited) return limited
    const body = await readJsonBody(req, 4_096)
    if (!body) return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })

    const tenant_id = String(body?.tenant_id || '')
    const booking_date = String(body?.booking_date || '')

    const requested_staff_id =
      body?.staff_id === null ||
      body?.staff_id === undefined ||
      body?.staff_id === 'any'
        ? null
        : String(body.staff_id)

    if (!tenant_id || !booking_date) {
      return NextResponse.json(
        { error: 'Dati mancanti.' },
        { status: 400 },
      )
    }
    if (!isValidBookingDate(booking_date)) {
      return NextResponse.json({ error: 'Data non valida.' }, { status: 400 })
    }
    if (!isUuid(tenant_id) || (requested_staff_id && !isUuid(requested_staff_id))) {
      return NextResponse.json({ error: 'Identificativi non validi.' }, { status: 400 })
    }

    /**
     * Prenotazioni vere.
     * Nota:
     * - le cancelled non bloccano;
     * - le checkout_pending vecchie non devono bloccare;
     * - pending in salone, confirmed, done bloccano.
     */
    let bookingsQuery = supabaseAdmin
      .from('service_bookings')
      .select(
        'service_id, staff_id, booking_time, status, payment_status, checkout_pending, created_at',
      )
      .eq('tenant_id', tenant_id)
      .eq('booking_date', booking_date)
      .neq('status', 'cancelled')

    if (requested_staff_id) {
      bookingsQuery = bookingsQuery.eq('staff_id', requested_staff_id)
    }

    const { data: bookingRows, error: bookingsErr } = await bookingsQuery

    if (bookingsErr) {
      return NextResponse.json(
        { error: bookingsErr.message },
        { status: 500 },
      )
    }

    /**
     * Hold Stripe attivi.
     * Questi sono gli slot riservati mentre il cliente è su Stripe.
     */
    let holdsQuery = supabaseAdmin
      .from('service_booking_holds')
      .select('service_id, staff_id, booking_time, status, expires_at')
      .eq('tenant_id', tenant_id)
      .eq('booking_date', booking_date)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())

    if (requested_staff_id) {
      holdsQuery = holdsQuery.eq('staff_id', requested_staff_id)
    }

    const { data: holdRows, error: holdsErr } = await holdsQuery

    if (holdsErr) {
      return NextResponse.json(
        { error: holdsErr.message },
        { status: 500 },
      )
    }

    const realBookings = ((bookingRows || []) as BusyRow[]).filter(row => {
      // sicurezza: eventuali vecchie prenotazioni checkout_pending non devono più bloccare
      if (row.checkout_pending === true) return false

      return true
    })

    const activeHolds = (holdRows || []) as BusyRow[]

    const blockingRows = [...realBookings, ...activeHolds]

    return NextResponse.json({
      bookings: blockingRows.map(row => ({
        service_id: row.service_id,
        staff_id: row.staff_id,
        booking_time: row.booking_time,
        status: row.status,
      })),
    })
  } catch (e) {
    console.error('booked-slots error:', e)

    return NextResponse.json(
      { error: 'Errore caricamento prenotazioni.' },
      { status: 500 },
    )
  }
}
