'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Booking = {
  id: string
  tenant_id: string
  service_id: string
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  note?: string | null
  staff_id?: string | null
  booking_date: string
  booking_time: string
  status: 'pending' | 'confirmed' | 'done' | 'cancelled'
  payment_status?: 'unpaid' | 'paid' | null
}

type Service = {
  id: string
  name: string
  duration_minutes: number
  price_cents: number
}

type Staff = {
  id: string
  name: string
  is_active: boolean
  position: number
}

type HoursRow = {
  dow: number
  is_closed: boolean | null
  open_time_am?: string | null
  close_time_am?: string | null
  pm_enabled?: boolean | null
  open_time_pm?: string | null
  close_time_pm?: string | null
  has_split?: boolean | null
  open_time?: string | null
  close_time?: string | null
}

const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function fmtTime(t: string) {
  const parts = String(t || '').split(':')
  return `${parts[0] || '00'}:${parts[1] || '00'}`
}
function timeToMinutes(t: string) {
  const parts = String(t || '').split(':')
  const h = parseInt(parts[0] || '0', 10)
  const m = parseInt(parts[1] || '0', 10)
  return h * 60 + m
}
function fmtDateShort(d: string) {
  const date = new Date(`${d}T00:00:00`)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

function fmtDateLong(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function dateToYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function statusChip(status: Booking['status']) {

  if (status === 'pending') {
    return {
      label: 'In attesa',
      cls: 'bg-amber-100 text-amber-800 border-amber-200',
    }
  }
  if (status === 'confirmed') {
    return {
      label: 'Confermata',
      cls: 'bg-green-100 text-green-800 border-green-200',
    }
  }
  if (status === 'done') {
    return {
      label: 'Completata',
      cls: 'bg-blue-100 text-blue-800 border-blue-200',
    }
  }
  return {
    label: 'Cancellata',
    cls: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  }
}
function paymentChip(paymentStatus?: 'unpaid' | 'paid' | null) {
  if (paymentStatus === 'paid') {
    return {
      label: 'Pagato',
      cls: 'bg-green-100 text-green-800 border-green-200',
    }
  }

  return {
    label: 'Da pagare',
    cls: 'bg-orange-100 text-orange-800 border-orange-200',
  }
}
export default function ServiceCalendarClient({ tenantId }: { tenantId: string }) {
  const [services, setServices] = useState<Service[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [hours, setHours] = useState<HoursRow[]>([])
  const [staff, setStaff] = useState<Staff[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [savingAction, setSavingAction] = useState(false)
const [statusFilter, setStatusFilter] = useState<
  'all' | 'pending' | 'confirmed' | 'done' | 'cancelled'
>('all')
const [searchTerm, setSearchTerm] = useState('')
const [staffFilter, setStaffFilter] = useState<'all' | string>('all')
  const [weekStart, setWeekStart] = useState<string>(() => {
    const mon = getMonday(new Date())
    return dateToYMD(mon)
  })

  const serviceById = useMemo(() => {
    const map: Record<string, Service> = {}
    services.forEach(s => {
      map[s.id] = s
    })
    return map
  }, [services])

  const staffById = useMemo(() => {
    const map: Record<string, Staff> = {}
    staff.forEach(s => {
      map[s.id] = s
    })
    return map
  }, [staff])

  const selectedBooking = useMemo(() => {
    if (!selectedBookingId) return null
    return bookings.find(b => b.id === selectedBookingId) || null
  }, [bookings, selectedBookingId])
const filteredBookings = useMemo(() => {
  const q = searchTerm.trim().toLowerCase()

  return bookings.filter(b => {
    const matchStatus = statusFilter === 'all' ? true : b.status === statusFilter
    const matchStaff = staffFilter === 'all' ? true : b.staff_id === staffFilter
    const matchSearch =
      q.length === 0 ? true : b.customer_name.toLowerCase().includes(q)

    return matchStatus && matchStaff && matchSearch
  })
}, [bookings, statusFilter, staffFilter, searchTerm])
  const selectedService = useMemo(() => {
    if (!selectedBooking) return null
    return serviceById[selectedBooking.service_id] || null
  }, [selectedBooking, serviceById])

  const weekDays = useMemo(() => {
    const base = new Date(`${weekStart}T00:00:00`)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base)
      d.setDate(d.getDate() + i)
      return dateToYMD(d)
    })
  }, [weekStart])

  useEffect(() => {
    if (!tenantId) return

    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: svcRows, error: svcErr } = await supabase
          .from('services')
          .select('id, name, duration_minutes, price_cents')
          .eq('tenant_id', tenantId)

        if (svcErr) throw svcErr
        if (!cancelled) setServices((svcRows || []) as Service[])

        const { data: staffRows, error: staffErr } = await supabase
          .from('staff_members')
          .select('id, name, is_active, position')
          .eq('tenant_id', tenantId)
          .order('position', { ascending: true })
          .order('name', { ascending: true })

        if (staffErr) throw staffErr
        if (!cancelled) setStaff((staffRows || []) as Staff[])

        const { data: hRows, error: hErr } = await supabase
          .from('tenant_hours')
          .select(
            'dow, is_closed, open_time_am, close_time_am, pm_enabled, open_time_pm, close_time_pm, has_split, open_time, close_time',
          )
          .eq('tenant_id', tenantId)

        if (hErr) throw hErr
        if (!cancelled) setHours((hRows || []) as HoursRow[])

        const start = weekDays[0]
        const end = weekDays[6]

        const { data: bRows, error: bErr } = await supabase
  .from('service_bookings')
  .select(
    'id, tenant_id, service_id, staff_id, customer_name, customer_phone, customer_email, note, booking_date, booking_time, status, payment_status',
  )
          .eq('tenant_id', tenantId)
          .gte('booking_date', start)
          .lte('booking_date', end)
          .order('booking_date', { ascending: true })
          .order('booking_time', { ascending: true })

        if (bErr) throw bErr
        if (!cancelled) setBookings((bRows || []) as Booking[])
      } catch (e: any) {
        console.error(e)
        if (!cancelled) {
          setError(e?.message || 'Errore nel caricamento del calendario.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tenantId, weekDays])

  const timeSlots = useMemo(() => {
    const fallback = () => {
      const slots: string[] = []
      for (let h = 9; h < 19; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`)
        slots.push(`${String(h).padStart(2, '0')}:30`)
      }
      return slots
    }

    if (!hours.length) return fallback()

    function toMinutes(t?: string | null) {
      if (!t) return null
      const s = t.slice(0, 5)
      const [hh, mm] = s.split(':')
      return (parseInt(hh || '0', 10) || 0) * 60 + (parseInt(mm || '0', 10) || 0)
    }

    let minOpen = Infinity
    let maxClose = -Infinity

    for (const h of hours) {
      if (h.is_closed) continue

      const amOpen = toMinutes(h.open_time_am ?? h.open_time)
      const amClose = toMinutes(h.close_time_am ?? h.close_time)
      if (amOpen != null && amClose != null && amClose > amOpen) {
        minOpen = Math.min(minOpen, amOpen)
        maxClose = Math.max(maxClose, amClose)
      }

      const pmEnabled = Boolean(h.pm_enabled ?? h.has_split ?? false)
      if (pmEnabled) {
        const pmOpen = toMinutes(h.open_time_pm)
        const pmClose = toMinutes(h.close_time_pm)
        if (pmOpen != null && pmClose != null && pmClose > pmOpen) {
          minOpen = Math.min(minOpen, pmOpen)
          maxClose = Math.max(maxClose, pmClose)
        }
      }
    }

    if (!isFinite(minOpen) || !isFinite(maxClose) || maxClose <= minOpen) {
      return fallback()
    }

    const step = 30
    const slots: string[] = []

    for (let m = minOpen; m < maxClose; m += step) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0')
      const mm = String(m % 60).padStart(2, '0')
      slots.push(`${hh}:${mm}`)
    }

    return slots
  }, [hours])

const bookingsByDayTime = useMemo(() => {
  const map: Record<string, Booking[]> = {}
  filteredBookings.forEach(b => {
    const time = fmtTime(b.booking_time)
    const key = `${b.booking_date}__${time}`
    if (!map[key]) map[key] = []
    map[key].push(b)
  })
  return map
}, [filteredBookings])

  function goPrevWeek() {
    const base = new Date(`${weekStart}T00:00:00`)
    base.setDate(base.getDate() - 7)
    setWeekStart(dateToYMD(getMonday(base)))
  }

  function goNextWeek() {
    const base = new Date(`${weekStart}T00:00:00`)
    base.setDate(base.getDate() + 7)
    setWeekStart(dateToYMD(getMonday(base)))
  }

  const weekLabel = useMemo(() => {
    const start = new Date(`${weekStart}T00:00:00`)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return `${start.toLocaleDateString('it-IT')} - ${end.toLocaleDateString('it-IT')}`
  }, [weekStart])

  function openDrawer(bookingId: string) {
    setSelectedBookingId(bookingId)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setTimeout(() => setSelectedBookingId(null), 150)
  }

  async function setBookingStatus(id: string, status: Booking['status']) {
    try {
      setSavingAction(true)
      const { error } = await supabase
        .from('service_bookings')
        .update({ status })
        .eq('id', id)

      if (error) throw error

      setBookings(prev => prev.map(b => (b.id === id ? { ...b, status } : b)))
      closeDrawer()
    } catch (e: any) {
      console.error(e)
      alert(e?.message || 'Errore nel salvataggio.')
    } finally {
      setSavingAction(false)
    }
  }
async function quickSetBookingStatus(
  e: React.MouseEvent,
  id: string,
  status: Booking['status'],
) {
  e.stopPropagation()

  try {
    setSavingAction(true)

    const { error } = await supabase
      .from('service_bookings')
      .update({ status })
      .eq('id', id)

    if (error) throw error

    setBookings(prev => prev.map(b => (b.id === id ? { ...b, status } : b)))
  } catch (e: any) {
    console.error(e)
    alert(e?.message || 'Errore nel salvataggio.')
  } finally {
    setSavingAction(false)
  }
}
const slotStepMinutes = useMemo(() => {
  if (timeSlots.length < 2) return 30
  return timeToMinutes(timeSlots[1]) - timeToMinutes(timeSlots[0])
}, [timeSlots])

const occupiedCells = useMemo(() => {
  const set = new Set<string>()

  filteredBookings.forEach(b => {
    const svc = serviceById[b.service_id]
    const duration = svc?.duration_minutes || 30
    const start = timeToMinutes(fmtTime(b.booking_time))
    const span = Math.max(1, Math.ceil(duration / slotStepMinutes))

    for (let i = 1; i < span; i++) {
      const blockedTime = start + i * slotStepMinutes
      const hh = String(Math.floor(blockedTime / 60)).padStart(2, '0')
      const mm = String(blockedTime % 60).padStart(2, '0')
      set.add(`${b.booking_date}__${hh}:${mm}`)
    }
  })

  return set
}, [filteredBookings, serviceById, slotStepMinutes])
  return (
    <main className="p-6 max-w-6xl mx-auto grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendario settimanale</h1>
          <div className="text-sm text-zinc-600">{weekLabel}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevWeek}
            className="px-3 py-2 border rounded-xl text-sm bg-white hover:bg-zinc-50"
          >
            ← Settimana precedente
          </button>
          <button
            type="button"
            onClick={goNextWeek}
            className="px-3 py-2 border rounded-xl text-sm bg-white hover:bg-zinc-50"
          >
            Settimana successiva →
          </button>
        </div>
      </header>

      {error && (
        <div className="text-sm text-red-700 border rounded-xl p-3 bg-red-50">
          {error}
        </div>
      )}
<div className="border rounded-2xl bg-white shadow-sm p-4 grid gap-3">
  <div className="font-semibold">Filtri</div>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    <div className="grid gap-1 text-sm">
      <label className="font-medium">Cerca cliente</label>
      <input
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Es. Marco"
        className="border rounded-xl px-3 py-2 bg-white"
      />
    </div>

    <div className="grid gap-1 text-sm">
      <label className="font-medium">Stato</label>
      <select
        value={statusFilter}
        onChange={e => setStatusFilter(e.target.value as any)}
        className="border rounded-xl px-3 py-2 bg-white"
      >
        <option value="all">Tutti gli stati</option>
        <option value="pending">In attesa</option>
        <option value="confirmed">Confermate</option>
        <option value="done">Completate</option>
        <option value="cancelled">Cancellate</option>
      </select>
    </div>

    <div className="grid gap-1 text-sm">
      <label className="font-medium">Operatore</label>
      <select
        value={staffFilter}
        onChange={e => setStaffFilter(e.target.value)}
        className="border rounded-xl px-3 py-2 bg-white"
      >
        <option value="all">Tutti gli operatori</option>
        {staff.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  </div>

  <div className="flex items-center justify-between gap-3">
    <div className="text-xs text-zinc-500">
      Visualizzate {filteredBookings.length} prenotazioni su {bookings.length}
    </div>

    <button
      type="button"
      onClick={() => {
        setStatusFilter('all')
        setStaffFilter('all')
        setSearchTerm('')
      }}
      className="text-sm underline underline-offset-2 text-zinc-600"
    >
      Azzera filtri
    </button>
  </div>
</div>
      <div className="w-full overflow-auto border rounded-2xl bg-white text-xs shadow-sm">
        <table className="min-w-full border-collapse">
          <thead className="bg-zinc-50 sticky top-0 z-10">
            <tr>
              <th className="border-b border-r border-zinc-100 px-3 py-2 w-20 text-left">Ora</th>
              {weekDays.map((d, idx) => (
                <th
                  key={d}
                  className="border-b border-r border-zinc-100 px-3 py-2 text-left min-w-[140px]"
                >
                  <div className="font-semibold">
                    {DOW_LABELS[idx]} {fmtDateShort(d)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="text-center text-zinc-500 px-4 py-10">
                  Caricamento calendario…
                </td>
              </tr>
            )}

            {!loading &&
              timeSlots.map(time => (
                <tr key={time} className="h-14">
                  <td className="border-t border-r border-zinc-100 px-3 py-2 text-right align-top bg-zinc-50 whitespace-nowrap">
                    {time}
                  </td>

                  {weekDays.map(day => {
  const key = `${day}__${time}`

  if (occupiedCells.has(key)) {
    return null
  }

  const list = bookingsByDayTime[key] || []
  const firstBooking = list[0] || null
  const firstService = firstBooking ? serviceById[firstBooking.service_id] : null
  const rowSpan = firstBooking
    ? Math.max(1, Math.ceil((firstService?.duration_minutes || 30) / slotStepMinutes))
    : 1

  return (
    <td
      key={day}
      rowSpan={rowSpan}
      className="border-t border-r border-zinc-100 px-2 py-2 align-top"
    >
      {list.map(b => {
                          const svc = serviceById[b.service_id]
                          const label = svc ? svc.name : 'Servizio'
                          const staffName = b.staff_id
                            ? staffById[b.staff_id]?.name || 'Operatore'
                            : 'Qualsiasi'

                          const chip = statusChip(b.status)

                          let bg = 'bg-zinc-100'
                          let border = 'border-zinc-200'
                          if (b.status === 'pending') {
                            bg = 'bg-amber-100'
                            border = 'border-amber-200'
                          }
                          if (b.status === 'confirmed') {
                            bg = 'bg-green-100'
                            border = 'border-green-200'
                          }
                          if (b.status === 'cancelled') {
                            bg = 'bg-red-100'
                            border = 'border-red-200'
                          }

                          return (
                           <div
  key={b.id}
  role="button"
  tabIndex={0}
  onClick={() => {
    setSelectedBookingId(b.id)
    setDrawerOpen(true)
  }}
  onKeyDown={e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelectedBookingId(b.id)
      setDrawerOpen(true)
    }
  }}
  className={`w-full text-left rounded-xl border px-3 py-2 text-xs cursor-pointer shadow-sm hover:shadow-md transition ${chip.cls}`}
>
  <div className="flex items-start justify-between gap-2">
    <div className="font-semibold truncate text-[12px]">{b.customer_name}</div>

    <span
      className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold border ${
        b.payment_status === 'paid'
          ? 'bg-green-100 text-green-800 border-green-200'
          : 'bg-orange-100 text-orange-800 border-orange-200'
      }`}
    >
      {b.payment_status === 'paid' ? '€ Pagato' : '€ Da pagare'}
    </span>
  </div>

 <div className="truncate text-[11px] mt-0.5 opacity-90">
  {svc?.name || 'Servizio'}
</div>

  {b.staff_id ? (
    <div className="truncate text-[10px] opacity-70 uppercase tracking-wide mt-0.5">
  {staffById[b.staff_id]?.name || 'Operatore'}
</div>
  ) : null}

  {b.status === 'pending' ? (
    <div className="flex items-center gap-2 mt-2">
      <button
        type="button"
        onClick={e => quickSetBookingStatus(e, b.id, 'confirmed')}
        disabled={savingAction}
        className="inline-flex items-center justify-center h-7 w-7 rounded-full border bg-white text-green-700 border-green-300 hover:bg-green-50 disabled:opacity-50"
        title="Conferma"
      >
        ✓
      </button>

      <button
        type="button"
        onClick={e => quickSetBookingStatus(e, b.id, 'cancelled')}
        disabled={savingAction}
        className="inline-flex items-center justify-center h-7 w-7 rounded-full border bg-white text-red-700 border-red-300 hover:bg-red-50 disabled:opacity-50"
        title="Cancella"
      >
        ✕
      </button>
    </div>
  ) : b.status === 'confirmed' ? (
    <div className="flex items-center gap-2 mt-2">
      <button
        type="button"
        onClick={e => quickSetBookingStatus(e, b.id, 'done')}
        disabled={savingAction}
        className="inline-flex items-center justify-center px-2.5 py-1 rounded-full border bg-white text-blue-700 border-blue-300 hover:bg-blue-50 disabled:opacity-50 text-[11px] font-semibold"
        title="Segna come completata"
      >
        Completata
      </button>
    </div>
  ) : null}
</div>
                          )
                        })}
                      </td>
                    )
                  })}
                </tr>
              ))}

           {!loading && filteredBookings.length === 0 && (
  <tr>
    <td colSpan={8} className="text-center text-zinc-500 px-4 py-10">
      Nessuna prenotazione trovata con i filtri selezionati.
    </td>
  </tr>
)}
          </tbody>
        </table>
      </div>

      <div
        className={`fixed inset-0 z-50 ${
          drawerOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={closeDrawer}
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            drawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div
          className={[
            'absolute bg-white shadow-2xl transition-transform',
            'w-full md:w-[420px]',
            'rounded-t-2xl md:rounded-none md:rounded-l-2xl',
            'bottom-0 md:bottom-0 md:top-0 md:right-0',
            drawerOpen
              ? 'translate-y-0 md:translate-x-0'
              : 'translate-y-full md:translate-x-full',
          ].join(' ')}
        >
          <div className="p-4 border-b flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-zinc-500">Dettagli prenotazione</div>
              <div className="text-lg font-semibold truncate">
                {selectedBooking?.customer_name || '—'}
              </div>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50"
            >
              Chiudi
            </button>
          </div>

          <div className="p-4 grid gap-3">
            {!selectedBooking ? (
              <div className="text-sm text-zinc-500">Seleziona una prenotazione…</div>
            ) : (
              <>
                <div className="grid gap-2">
                  <div className="text-xs text-zinc-500">Servizio</div>
                  <div className="font-semibold">{selectedService?.name || '—'}</div>
                  {selectedService && (
                    <div className="text-sm text-zinc-600">
                      Durata: {selectedService.duration_minutes} min
                    </div>
                  )}
                </div>

                <div className="grid gap-1">
                  <div className="text-xs text-zinc-500">Quando</div>
                  <div className="font-semibold">
                    {fmtDateLong(selectedBooking.booking_date)} •{' '}
                    {fmtTime(selectedBooking.booking_time)}
                    
                  </div>
                </div>
<div className="grid gap-1">
  <div className="text-xs text-zinc-500">Operatore</div>
  <div className="font-semibold">
    {selectedBooking.staff_id
      ? staffById[selectedBooking.staff_id]?.name || 'Operatore'
      : 'Assegnazione automatica'}
  </div>
</div>

<div className="grid grid-cols-2 gap-3">
  <div className="grid gap-1">
    <div className="text-xs text-zinc-500">Telefono</div>
    <div className="font-medium">
      {selectedBooking.customer_phone || '—'}
    </div>
  </div>

  <div className="grid gap-1">
    <div className="text-xs text-zinc-500">Email</div>
    <div className="font-medium break-all">
      {selectedBooking.customer_email || '—'}
    </div>
  </div>
</div>
                {/* STATO PRENOTAZIONE */}
<div className="grid gap-1">
  <div className="text-xs text-zinc-500">Stato prenotazione</div>
  <div>
    {(() => {
      const chip = statusChip(selectedBooking.status)
      return (
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${chip.cls}`}
        >
          {chip.label}
        </span>
      )
    })()}
  </div>
</div>

{/* PAGAMENTO + TOTALE */}
<div className="grid grid-cols-2 gap-3">
  <div className="grid gap-1">
    <div className="text-xs text-zinc-500">Pagamento</div>
    <div>
      {(() => {
        const chip = paymentChip(selectedBooking.payment_status)
        return (
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${chip.cls}`}
          >
            {chip.label}
          </span>
        )
      })()}
    </div>
  </div>

  <div className="grid gap-1">
    <div className="text-xs text-zinc-500">Totale</div>
    <div className="font-semibold">
      {selectedService
        ? `€ ${(selectedService.price_cents / 100).toFixed(2)}`
        : '—'}
    </div>
  </div>
</div>

{/* NOTE CLIENTE */}
<div className="grid gap-1">
  <div className="text-xs text-zinc-500">Note cliente</div>
  <div className="text-sm text-zinc-700 rounded-xl border bg-zinc-50 px-3 py-2 min-h-[44px]">
    {selectedBooking.note || 'Nessuna nota'}
  </div>
</div>

                <div className="pt-2 grid gap-2">
                  <div className="pt-2 grid gap-2">

  {selectedBooking.status === 'pending' && (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        disabled={savingAction}
        onClick={() => setBookingStatus(selectedBooking.id, 'confirmed')}
        className="px-4 py-3 rounded-xl border text-sm font-semibold hover:bg-zinc-50 disabled:opacity-60"
      >
        Conferma
      </button>

      <button
        type="button"
        disabled={savingAction}
        onClick={() => setBookingStatus(selectedBooking.id, 'cancelled')}
        className="px-4 py-3 rounded-xl border text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
        style={{ borderColor: '#fecaca', color: '#b91c1c' }}
      >
        Cancella
      </button>
    </div>
  )}

  {selectedBooking.status === 'confirmed' && (
    <button
      type="button"
      disabled={savingAction}
      onClick={() => setBookingStatus(selectedBooking.id, 'done')}
      className="px-4 py-3 rounded-xl border text-sm font-semibold hover:bg-blue-50 disabled:opacity-60"
      style={{ borderColor: '#bfdbfe', color: '#1d4ed8' }}
    >
      Segna come completata
    </button>
  )}

  {selectedBooking.status !== 'cancelled' &&
    selectedBooking.status !== 'pending' && (
      <button
        type="button"
        disabled={savingAction}
        onClick={() => setBookingStatus(selectedBooking.id, 'cancelled')}
        className="px-4 py-3 rounded-xl border text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
        style={{ borderColor: '#fecaca', color: '#b91c1c' }}
      >
        Cancella prenotazione
      </button>
    )}

  <button
    type="button"
    onClick={closeDrawer}
    className="px-4 py-3 rounded-xl border text-sm font-semibold hover:bg-zinc-50"
  >
    Chiudi
  </button>
</div>
                </div>
              </>
            )}
          </div>

          <div className="h-6 md:hidden" />
        </div>
      </div>
    </main>
  )
}