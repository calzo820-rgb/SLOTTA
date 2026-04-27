// src/app/api/service-book/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function timeStrToMinutes(s: string): number {
  const parts = String(s || '').split(':')
  const h = parseInt(parts[0] || '0', 10)
  const m = parseInt(parts[1] || '0', 10)
  return h * 60 + m
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
    if (!customer_email || !customer_email.includes('@')) {
      return NextResponse.json({ error: 'Email non valida.' }, { status: 400 })
    }
    // blocco prenotazioni nel passato o troppo vicine
    const now = new Date()
    const todayStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')

    const leadMinutes = 30
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
    // 1) leggo settings (staff mode)
    const { data: st, error: stErr } = await supabaseAdmin
      .from('tenant_settings')
      .select('staff_assign_mode, staff_rr_cursor')
      .eq('tenant_id', tenant_id)
      .maybeSingle()

    if (stErr) throw stErr

    const staff_assign_mode = (st?.staff_assign_mode || 'first_free') as
      | 'first_free'
      | 'round_robin'

    const rr_cursor = Number(st?.staff_rr_cursor || 0)

    // 2) durata servizio
    const { data: svc, error: svcErr } = await supabaseAdmin
      .from('services')
      .select('duration_minutes')
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
        customer_name,
        customer_email,
        customer_phone,
        booking_date,
        booking_time,
        note,
        status: 'pending',
        payment_status: 'unpaid',
      })
      .select('id, staff_id')
      .single()

    if (insErr) throw insErr

    return NextResponse.json({ booking_id: inserted.id, staff_id: inserted.staff_id })
  } catch (e: any) {
    console.error('service-book error', e)
    return NextResponse.json(
      { error: e?.message || 'Errore server.' },
      { status: 500 },
    )
  }
}
