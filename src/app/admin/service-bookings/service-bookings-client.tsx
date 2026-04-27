'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Booking = {
  id: string
  tenant_id: string
  service_id: string
  staff_id?: string | null
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  booking_date: string
  booking_time: string
  note?: string | null
  status: 'pending' | 'confirmed' | 'done' | 'cancelled'
  payment_status: 'unpaid' | 'paid'
  created_at: string
}

type Service = {
  id: string
  name: string
  duration_minutes: number
  price_cents: number
}

function fmtTime(t: string) {
  const parts = String(t || '').split(':')
  return `${parts[0] || '00'}:${parts[1] || '00'}`
}

function fmtDate(d: string) {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString('it-IT')
  } catch {
    return d
  }
}

function euro(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function timeStrToMinutes(s: string): number {
  const parts = String(s || '').split(':')
  const h = parseInt(parts[0] || '0', 10)
  const m = parseInt(parts[1] || '0', 10)
  return h * 60 + m
}

function buildGoogleCalendarLink(booking: Booking, service?: Service): string {
  const duration = service?.duration_minutes || 60
  const datePlain = booking.booking_date.replace(/-/g, '')

  const [hh, mm] = String(booking.booking_time || '00:00').split(':')
  const startMinutes = timeStrToMinutes(booking.booking_time)
  const endMinutes = startMinutes + duration

  const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0')
  const endM = String(endMinutes % 60).padStart(2, '0')

  const startStr = `${datePlain}T${(hh || '00')}${(mm || '00')}00`
  const endStr = `${datePlain}T${endH}${endM}00`

  const title = encodeURIComponent(`Appuntamento: ${service?.name || 'servizio'}`)
  const details = encodeURIComponent(
    `Prenotazione presso il salone.\nCliente: ${booking.customer_name || ''}`,
  )

  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}`
}

function Badge({
  children,
  tone = 'zinc',
}: {
  children: React.ReactNode
  tone?: 'zinc' | 'green' | 'amber' | 'red' | 'blue' | 'orange'
}) {
  const map: Record<string, string> = {
    zinc: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${map[tone]}`}
    >
      {children}
    </span>
  )
}

function statusLabel(s: Booking['status']) {
  if (s === 'pending') return { text: 'In attesa', tone: 'amber' as const }
  if (s === 'confirmed') return { text: 'Confermata', tone: 'green' as const }
  if (s === 'done') return { text: 'Completata', tone: 'blue' as const }
  return { text: 'Cancellata', tone: 'zinc' as const }
}

function payLabel(p: Booking['payment_status']) {
  if (p === 'paid') return { text: 'Pagato', tone: 'green' as const }
  return { text: 'Da pagare', tone: 'orange' as const }
}

export default function ServiceBookingsClient({ tenantId }: { tenantId: string }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staffNameById, setStaffNameById] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)

  const [onlyPending, setOnlyPending] = useState(false)
  const [onlyUnpaid, setOnlyUnpaid] = useState(false)
  const [dateFilter, setDateFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  const serviceById = useMemo(() => {
    const map: Record<string, Service> = {}
    services.forEach(s => {
      map[s.id] = s
    })
    return map
  }, [services])

  const selectedBooking = useMemo(() => {
    if (!selectedBookingId) return null
    return bookings.find(b => b.id === selectedBookingId) || null
  }, [bookings, selectedBookingId])

  const selectedService = useMemo(() => {
    return selectedBooking ? serviceById[selectedBooking.service_id] : null
  }, [selectedBooking, serviceById])

  const selectedStaffName = useMemo(() => {
    if (!selectedBooking) return null
    if (!selectedBooking.staff_id) return 'Qualsiasi'
    return staffNameById[selectedBooking.staff_id] || 'Operatore'
  }, [selectedBooking, staffNameById])

  const kpi = useMemo(() => {
    const list = dateFilter ? bookings.filter(b => b.booking_date === dateFilter) : bookings

    const total = list.length
    const pending = list.filter(b => b.status === 'pending').length
    const unpaid = list.filter(
      b => b.payment_status === 'unpaid' && b.status !== 'cancelled',
    ).length

    const revenueCents = list.reduce((acc, b) => {
      if (b.payment_status !== 'paid') return acc
      const svc = serviceById[b.service_id]
      return acc + (svc?.price_cents || 0)
    }, 0)

    return { total, pending, unpaid, revenueEuro: euro(revenueCents) }
  }, [bookings, dateFilter, serviceById])

  async function loadBookingsData() {
    if (!tenantId) return

    setLoading(true)
    setError(null)

    try {
      const { data: svcRows, error: svcErr } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price_cents')
        .eq('tenant_id', tenantId)

      if (svcErr) throw svcErr
      setServices((svcRows || []) as Service[])

      const { data: staffRows, error: staffErr } = await supabase
        .from('staff_members')
        .select('id, name')
        .eq('tenant_id', tenantId)

      if (staffErr) throw staffErr

      const map: Record<string, string> = {}
      ;(staffRows || []).forEach((s: any) => {
        map[s.id] = s.name
      })
      setStaffNameById(map)

      const { data: bRows, error: bErr } = await supabase
        .from('service_bookings')
        .select(
          'id, tenant_id, service_id, staff_id, customer_name, customer_phone, customer_email, booking_date, booking_time, note, status, payment_status, created_at',
        )
        .eq('tenant_id', tenantId)
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true })

      if (bErr) throw bErr
      setBookings((bRows || []) as Booking[])
    } catch (e: any) {
      console.error(e)
      setError(e?.message || 'Errore nel caricamento delle prenotazioni.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!tenantId) return
    loadBookingsData()
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) return

    const channel = supabase
      .channel(`service-bookings-admin-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_bookings',
          filter: `tenant_id=eq.${tenantId}`,
        },
        async () => {
          await loadBookingsData()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId])

  const filteredBookings = useMemo(() => {
  let list = bookings
  const q = searchTerm.trim().toLowerCase()

  if (dateFilter) list = list.filter(b => b.booking_date === dateFilter)
  if (onlyPending) list = list.filter(b => b.status === 'pending')
  if (onlyUnpaid) {
    list = list.filter(
      b => b.payment_status === 'unpaid' && b.status !== 'cancelled',
    )
  }

  if (q) {
    list = list.filter(b => {
      const name = (b.customer_name || '').toLowerCase()
      const email = (b.customer_email || '').toLowerCase()
      const phone = (b.customer_phone || '').toLowerCase()
      return (
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q)
      )
    })
  }

  return list
}, [bookings, dateFilter, onlyPending, onlyUnpaid, searchTerm])

  function setToday() {
    const d = new Date()
    setDateFilter(d.toISOString().slice(0, 10))
  }

  function setTomorrow() {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    setDateFilter(d.toISOString().slice(0, 10))
  }

  async function sendEmail(to: string, subject: string, html: string) {
    try {
      const res = await fetch('/api/send-confirmation-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html }),
      })
      await res.json().catch(() => null)
    } catch (e) {
      console.error('Errore invio email:', e)
    }
  }

  async function updateStatus(id: string, status: Booking['status']) {
    const booking = bookings.find(b => b.id === id)
    const service = booking ? serviceById[booking.service_id] : undefined

    await supabase.from('service_bookings').update({ status }).eq('id', id)
    setBookings(prev => prev.map(b => (b.id === id ? { ...b, status } : b)))

    if (!booking) return

    const to = (booking.customer_email || '').trim().toLowerCase()
    if (!to || !to.includes('@')) return

    const dateStr = fmtDate(booking.booking_date)
    const timeStr = fmtTime(booking.booking_time)
    const serviceName = service?.name || 'servizio'

    if (status === 'confirmed') {
      const calendarUrl = buildGoogleCalendarLink(booking, service)
      const subject = 'La tua prenotazione è stata confermata'
      const html = `
        <p>Ciao ${booking.customer_name || ''},</p>
        <p>la tua prenotazione è stata <strong>confermata</strong>.</p>
        <ul>
          <li>Servizio: <strong>${serviceName}</strong></li>
          <li>Data: <strong>${dateStr}</strong></li>
          <li>Ora: <strong>${timeStr}</strong></li>
        </ul>
        <p><a href="${calendarUrl}" target="_blank" rel="noopener noreferrer">➕ Aggiungi al tuo calendario</a></p>
        <p>Ti aspettiamo in salone!</p>
      `
      await sendEmail(to, subject, html)
    }

    if (status === 'cancelled') {
      const subject = 'La tua prenotazione è stata rifiutata'
      const html = `
        <p>Ciao ${booking.customer_name || ''},</p>
        <p>ti informiamo che la tua richiesta di prenotazione è stata <strong>rifiutata</strong>.</p>
        <ul>
          <li>Servizio: <strong>${serviceName}</strong></li>
          <li>Data: <strong>${dateStr}</strong></li>
          <li>Ora: <strong>${timeStr}</strong></li>
        </ul>
        <p>Per maggiori informazioni o per fissare un nuovo orario, contatta il salone.</p>
      `
      await sendEmail(to, subject, html)
    }
  }

  async function togglePaid(id: string, current: Booking['payment_status']) {
    const next: Booking['payment_status'] = current === 'paid' ? 'unpaid' : 'paid'

    await supabase
      .from('service_bookings')
      .update({ payment_status: next })
      .eq('id', id)

    setBookings(prev =>
      prev.map(b => (b.id === id ? { ...b, payment_status: next } : b)),
    )
  }

  async function deleteBooking(id: string) {
    if (!confirm('Vuoi davvero cancellare definitivamente questa prenotazione?')) return

    await supabase.from('service_bookings').delete().eq('id', id)
    setBookings(prev => prev.filter(b => b.id !== id))
  }

  return (
    <main className="p-4 sm:p-6 max-w-6xl mx-auto grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Prenotazioni</h1>
          <p className="text-sm text-zinc-600">
            Gestisci conferme, pagamenti e cancellazioni.
          </p>
        </div>

        <div className="text-xs text-zinc-500">Tenant attivo</div>
      </div>

      {error && (
        <div className="text-sm text-red-700 border rounded-xl p-3 bg-red-50">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl border bg-white px-3 py-2">
          <div className="text-[11px] text-zinc-500 leading-none">Totali</div>
          <div className="text-lg font-bold leading-tight">{kpi.total}</div>
        </div>

        <div className="rounded-xl border bg-white px-3 py-2">
          <div className="text-[11px] text-zinc-500 leading-none">In attesa</div>
          <div className="text-lg font-bold leading-tight">{kpi.pending}</div>
        </div>

        <div className="rounded-xl border bg-white px-3 py-2">
          <div className="text-[11px] text-zinc-500 leading-none">Da pagare</div>
          <div className="text-lg font-bold leading-tight">{kpi.unpaid}</div>
        </div>

        <div className="rounded-xl border bg-white px-3 py-2">
          <div className="text-[11px] text-zinc-500 leading-none">Incasso</div>
          <div className="text-lg font-bold leading-tight">€ {kpi.revenueEuro}</div>
        </div>
      </div>

      <section className="border rounded-2xl bg-white p-3 sm:p-4 shadow-sm">
  <div className="grid grid-cols-1 md:grid-cols-[220px_220px_1fr] gap-3 items-center">
    <div className="grid gap-1">
      <span className="text-xs text-zinc-500">Cerca cliente</span>
      <input
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Nome, email o telefono"
        className="border rounded-xl px-3 py-2 h-10"
      />
    </div>

    <div className="grid gap-1">
      <span className="text-xs text-zinc-500">Filtra per data</span>
      <input
        type="date"
        value={dateFilter}
        onChange={e => setDateFilter(e.target.value)}
        className="border rounded-xl px-3 py-2 h-10"
      />
    </div>

          <div className="flex flex-wrap gap-2 md:justify-end items-center">
            <button
              type="button"
              onClick={() => setOnlyPending(v => !v)}
              className={`px-3 py-2 h-10 rounded-xl border text-sm transition ${
                onlyPending
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'hover:bg-zinc-50'
              }`}
            >
              Solo in attesa
            </button>

            <button
              type="button"
              onClick={() => setOnlyUnpaid(v => !v)}
              className={`px-3 py-2 h-10 rounded-xl border text-sm transition ${
                onlyUnpaid
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'hover:bg-zinc-50'
              }`}
            >
              Solo non pagati
            </button>

            <div className="hidden md:block w-px h-6 bg-zinc-200 mx-1" />

            <button
              type="button"
              onClick={setToday}
              className="px-3 py-2 h-10 rounded-xl border text-sm hover:bg-zinc-50"
            >
              Oggi
            </button>
            <button
              type="button"
              onClick={setTomorrow}
              className="px-3 py-2 h-10 rounded-xl border text-sm hover:bg-zinc-50"
            >
              Domani
            </button>
            <button
              type="button"
              onClick={() => {
  setDateFilter('')
  setOnlyPending(false)
  setOnlyUnpaid(false)
  setSearchTerm('')
}}
              className="px-3 py-2 h-10 rounded-xl border text-sm hover:bg-zinc-50"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="border rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="px-4 py-3 border-b bg-zinc-50 flex items-center justify-between">
          <div className="font-semibold text-sm">Elenco prenotazioni</div>
          <div className="text-xs text-zinc-500">
            {dateFilter ? `Filtro: ${fmtDate(dateFilter)}` : 'Tutte le date'}
          </div>
        </div>

        <div className="sm:hidden divide-y">
          {loading && (
            <div className="px-4 py-10 text-center text-zinc-500">Caricamento…</div>
          )}

          {!loading && filteredBookings.length === 0 && (
            <div className="px-4 py-10 text-center text-zinc-500">
              Nessuna prenotazione trovata.
            </div>
          )}

          {!loading &&
            filteredBookings.map(b => {
              const svc = serviceById[b.service_id]
              const isPending = b.status === 'pending'
              const sLabel = statusLabel(b.status)
              const pLabel = payLabel(b.payment_status)
              const staffName = b.staff_id
                ? staffNameById[b.staff_id] || 'Operatore'
                : 'Qualsiasi'

              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setSelectedBookingId(b.id)
                    setDrawerOpen(true)
                  }}
                  className={[
                    'w-full text-left px-4 py-4 transition relative',
                    isPending ? 'bg-amber-50 active:bg-amber-100' : 'active:bg-zinc-50',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{svc?.name || '—'}</div>
                      <div className="text-xs text-zinc-500 mt-1">
                        {fmtDate(b.booking_date)} • {fmtTime(b.booking_time)}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Operatore:{' '}
                        <span className="font-medium text-zinc-700">{staffName}</span>
                      </div>

                      <div className="text-sm mt-2">
                        <span className="font-semibold">{b.customer_name || '—'}</span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-1 line-clamp-1">
                        {b.note || '—'}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-semibold whitespace-nowrap">
                        {svc ? `€ ${euro(svc.price_cents)}` : '—'}
                      </div>
                      <div className="mt-2 flex flex-col items-end gap-1">
                        <Badge tone={pLabel.tone}>{pLabel.text}</Badge>
                        <Badge tone={sLabel.tone}>{isPending ? 'Nuovo' : sLabel.text}</Badge>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="text-xs text-zinc-500">
                <th className="px-4 py-3 border-b">Quando</th>
                <th className="px-4 py-3 border-b">Servizio</th>
                <th className="px-4 py-3 border-b">Cliente</th>
                <th className="px-4 py-3 border-b">Operatore</th>
                <th className="px-4 py-3 border-b">Totale</th>
                <th className="px-4 py-3 border-b">Pagamento</th>
                <th className="px-4 py-3 border-b">Stato</th>
                <th className="px-4 py-3 border-b">Note</th>
                <th className="px-4 py-3 border-b text-right">Azioni</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-zinc-500">
                    Caricamento…
                  </td>
                </tr>
              )}

              {!loading && filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-zinc-500">
                    Nessuna prenotazione trovata.
                  </td>
                </tr>
              )}

              {filteredBookings.map(b => {
                const svc = serviceById[b.service_id]
                const isPending = b.status === 'pending'
                const sLabel = statusLabel(b.status)
                const pLabel = payLabel(b.payment_status)

                const contact = (b.customer_phone || '').trim()
                const isEmail = contact.includes('@')
                const staffName = b.staff_id
                  ? staffNameById[b.staff_id] || 'Operatore'
                  : 'Qualsiasi'

                return (
                  <tr
                    key={b.id}
                    onClick={() => {
                      setSelectedBookingId(b.id)
                      setDrawerOpen(true)
                    }}
                    className={[
                      'border-b transition cursor-pointer',
                      isPending ? 'bg-amber-50 hover:bg-amber-100/60' : 'hover:bg-zinc-50',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 align-top whitespace-nowrap relative">
                      {isPending && (
                        <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                      )}

                      <div className="font-semibold">{fmtDate(b.booking_date)}</div>
                      <div className="text-xs text-zinc-500">{fmtTime(b.booking_time)}</div>
                      {isPending && (
                        <div className="mt-1">
                          <Badge tone="amber">Nuovo</Badge>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold">{svc?.name || '—'}</div>
                      {svc && (
                        <div className="text-xs text-zinc-500">
                          {svc.duration_minutes} min
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold">{b.customer_name || '—'}</div>
                      <div className="text-xs text-zinc-500 mt-1">
                        {contact ? (
                          isEmail ? (
                            <span className="break-all">✉️ {contact}</span>
                          ) : (
                            <span className="break-all">📞 {contact}</span>
                          )
                        ) : (
                          '—'
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <span className="text-sm">{staffName}</span>
                    </td>

                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      {svc ? `€ ${euro(svc.price_cents)}` : '—'}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <Badge tone={pLabel.tone}>{pLabel.text}</Badge>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <Badge tone={sLabel.tone}>{sLabel.text}</Badge>
                    </td>

                    <td className="px-4 py-3 align-top max-w-[260px]">
                      <span className="text-xs text-zinc-600 line-clamp-2">
                        {b.note || '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="flex justify-end gap-2 flex-wrap">
                       {b.status === 'pending' ? (
  <>
    <button
      onClick={e => {
        e.stopPropagation()
        updateStatus(b.id, 'confirmed')
      }}
      className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50"
    >
      Conferma
    </button>

    <button
      onClick={e => {
        e.stopPropagation()
        updateStatus(b.id, 'cancelled')
      }}
      className="px-3 py-2 rounded-xl border text-sm hover:bg-red-50"
      style={{ borderColor: '#fecaca', color: '#b91c1c' }}
    >
      Rifiuta
    </button>
  </>
) : b.status === 'confirmed' ? (
  <>
    <button
      onClick={e => {
        e.stopPropagation()
        updateStatus(b.id, 'done')
      }}
      className="px-3 py-2 rounded-xl border text-sm hover:bg-blue-50"
      style={{ borderColor: '#bfdbfe', color: '#1d4ed8' }}
    >
      Completata
    </button>

    <button
      onClick={e => {
        e.stopPropagation()
        updateStatus(b.id, 'cancelled')
      }}
      className="px-3 py-2 rounded-xl border text-sm hover:bg-red-50"
      style={{ borderColor: '#fecaca', color: '#b91c1c' }}
    >
      Cancella
    </button>

    <button
      onClick={e => {
        e.stopPropagation()
        togglePaid(b.id, b.payment_status)
      }}
      className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50"
    >
      {b.payment_status === 'paid' ? 'Segna non pagato' : 'Segna pagato'}
    </button>
  </>
) : (
  <>
    {b.status !== 'cancelled' && (
      <button
        onClick={e => {
          e.stopPropagation()
          togglePaid(b.id, b.payment_status)
        }}
        className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50"
      >
        {b.payment_status === 'paid' ? 'Segna non pagato' : 'Segna pagato'}
      </button>
    )}

    <button
      onClick={e => {
        e.stopPropagation()
        deleteBooking(b.id)
      }}
      className="px-3 py-2 rounded-xl border text-sm hover:bg-red-50"
      style={{ borderColor: '#fecaca', color: '#b91c1c' }}
    >
      Elimina
    </button>
  </>
)}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {drawerOpen && selectedBooking && (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-label="Chiudi"
          />

          <div
            className="
              absolute bg-white shadow-2xl border
              w-full sm:w-[420px]
              sm:right-0 sm:top-0 sm:h-full sm:rounded-none sm:border-l
              left-0 right-0 bottom-0
              h-[85vh] rounded-t-3xl border-t
              flex flex-col
            "
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="sm:hidden px-4 pt-3">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-zinc-200" />
            </div>

            <div className="px-5 pt-4 pb-3 border-b">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-zinc-500">Dettaglio prenotazione</div>
                  <div className="text-lg font-bold truncate">
                    {selectedService?.name || 'Servizio'}
                  </div>
                  <div className="text-sm text-zinc-600 mt-1">
                    {fmtDate(selectedBooking.booking_date)} •{' '}
                    {fmtTime(selectedBooking.booking_time)}
                  </div>
                </div>

                <button
                  onClick={() => setDrawerOpen(false)}
                  className="shrink-0 px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50"
                >
                  Chiudi
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(() => {
                  const s = statusLabel(selectedBooking.status)
                  return <Badge tone={s.tone}>{s.text}</Badge>
                })()}
                {(() => {
                  const p = payLabel(selectedBooking.payment_status)
                  return <Badge tone={p.tone}>{p.text}</Badge>
                })()}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 text-sm">
                <div className="border rounded-2xl p-3 bg-zinc-50">
                  <div className="text-xs text-zinc-500">Cliente</div>
                  <div className="font-semibold">{selectedBooking.customer_name || '—'}</div>
                  <div className="text-xs text-zinc-600 mt-1 break-all">
                    {selectedBooking.customer_phone || '—'}
                  </div>

                  {!!selectedBooking.customer_phone && (
                    <button
                      className="mt-2 text-xs underline text-zinc-600"
                      onClick={() =>
                        navigator.clipboard.writeText(selectedBooking.customer_phone || '')
                      }
                    >
                      Copia contatto
                    </button>
                  )}
                </div>

                <div className="border rounded-2xl p-3 bg-white">
                  <div className="text-xs text-zinc-500">Operatore</div>
                  <div className="mt-1 font-semibold">{selectedStaffName || '—'}</div>
                </div>

                <div className="border rounded-2xl p-3 bg-white">
                  <div className="text-xs text-zinc-500">Durata e totale</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>{selectedService?.duration_minutes || 60} min</span>
                    <span className="font-semibold">
                      € {selectedService ? euro(selectedService.price_cents) : '—'}
                    </span>
                  </div>
                </div>

                <div className="border rounded-2xl p-3 bg-white">
                  <div className="text-xs text-zinc-500">Note</div>
                  <div className="mt-1 text-zinc-700 whitespace-pre-wrap">
                    {selectedBooking.note || '—'}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-zinc-500 mt-4">
                Tip: tocca fuori dal pannello per chiudere.
              </div>
            </div>

            <div className="px-5 py-4 border-t bg-white">
              <div className="grid gap-2">
               {selectedBooking.status === 'pending' ? (
  <>
    <button
      onClick={async () => {
        await updateStatus(selectedBooking.id, 'confirmed')
      }}
      className="w-full px-4 py-3 rounded-2xl border text-sm hover:bg-zinc-50"
    >
      ✅ Conferma prenotazione
    </button>

    <button
      onClick={async () => {
        await updateStatus(selectedBooking.id, 'cancelled')
      }}
      className="w-full px-4 py-3 rounded-2xl border text-sm hover:bg-red-50"
      style={{ borderColor: '#fecaca', color: '#b91c1c' }}
    >
      ❌ Rifiuta prenotazione
    </button>
  </>
) : selectedBooking.status === 'confirmed' ? (
  <>
    <button
      onClick={async () => {
        await updateStatus(selectedBooking.id, 'done')
      }}
      className="w-full px-4 py-3 rounded-2xl border text-sm hover:bg-blue-50"
      style={{ borderColor: '#bfdbfe', color: '#1d4ed8' }}
    >
      ✅ Segna come completata
    </button>

    <button
      onClick={async () => {
        await updateStatus(selectedBooking.id, 'cancelled')
      }}
      className="w-full px-4 py-3 rounded-2xl border text-sm hover:bg-red-50"
      style={{ borderColor: '#fecaca', color: '#b91c1c' }}
    >
      ❌ Cancella prenotazione
    </button>

    <button
      onClick={async () => {
        await togglePaid(selectedBooking.id, selectedBooking.payment_status)
      }}
      className="w-full px-4 py-3 rounded-2xl border text-sm hover:bg-zinc-50"
    >
      {selectedBooking.payment_status === 'paid'
        ? '↩️ Segna NON pagato'
        : '💳 Segna pagato'}
    </button>
  </>
) : (
  <>
    {selectedBooking.status !== 'cancelled' && (
      <button
        onClick={async () => {
          await togglePaid(selectedBooking.id, selectedBooking.payment_status)
        }}
        className="w-full px-4 py-3 rounded-2xl border text-sm hover:bg-zinc-50"
      >
        {selectedBooking.payment_status === 'paid'
          ? '↩️ Segna NON pagato'
          : '💳 Segna pagato'}
      </button>
    )}

    <button
      onClick={async () => {
        await deleteBooking(selectedBooking.id)
        setDrawerOpen(false)
      }}
      className="w-full px-4 py-3 rounded-2xl border text-sm hover:bg-red-50"
      style={{ borderColor: '#fecaca', color: '#b91c1c' }}
    >
      🗑️ Elimina prenotazione
    </button>
  </>
)}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}