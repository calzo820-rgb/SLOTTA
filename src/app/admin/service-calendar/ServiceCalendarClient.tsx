'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Booking, Service, Staff, HoursRow } from './types'
import { DOW_LABELS } from './constants'
import {
  fmtTime,
  timeToMinutes,
  fmtDateShort,
  dateToYMD,
  getMonday,
  calendarBookingVisual,
} from './utils'
import { BookingDrawer } from '../service-bookings/components/BookingDrawer'
export default function ServiceCalendarClient({ tenantId }: { tenantId: string }) {
  const [services, setServices] = useState<Service[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [hours, setHours] = useState<HoursRow[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [tenantName, setTenantName] = useState('')
const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
const [calendarExpanded, setCalendarExpanded] = useState(false)
  const [, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [, setSavingAction] = useState(false)
const [statusFilter, setStatusFilter] = useState<
  'all' | 'pending' | 'confirmed' | 'cancelled'
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

  // Compute the selected booking based on the selectedBookingId
  const selectedBooking: Booking | null = useMemo(() => {
    if (!selectedBookingId) return null
    return bookings.find(b => b.id === selectedBookingId) || null
  }, [bookings, selectedBookingId])
const filteredBookings = useMemo(() => {
  const q = searchTerm.trim().toLowerCase()

  return bookings.filter(b => {
    const matchStatus =
      statusFilter === 'all'
        ? b.status !== 'cancelled'
        : b.status === statusFilter

    const matchStaff = staffFilter === 'all' ? true : b.staff_id === staffFilter

    const matchSearch =
      q.length === 0 ? true : b.customer_name.toLowerCase().includes(q)

    return matchStatus && matchStaff && matchSearch
  })
}, [bookings, statusFilter, staffFilter, searchTerm])
  // Derive the selected service from the selected booking
  const selectedService: Service | null = useMemo(() => {
    if (!selectedBooking) return null
    return serviceById[selectedBooking.service_id] || null
  }, [selectedBooking, serviceById])
  const selectedStaffName = useMemo(() => {
  if (!selectedBooking?.staff_id) return 'Qualsiasi'
  return staffById[selectedBooking.staff_id]?.name || 'Operatore'
}, [selectedBooking, staffById])
async function updateStatus(id: string, status: Booking['status']) {
  try {
    setSavingAction(true)

    const { error } = await supabase
      .from('service_bookings')
      .update({ status })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw error

    setBookings(prev =>
      prev.map(b => (b.id === id ? { ...b, status } : b)),
    )
  } catch (e: unknown) {
    console.error(e)
    const message =
      e instanceof Error ? e.message : 'Errore aggiornamento prenotazione.'
    setError(message)
  } finally {
    setSavingAction(false)
  }
}

async function togglePaid(id: string, current: Booking['payment_status']) {
  try {
    setSavingAction(true)

    const nextPaymentStatus = current === 'paid' ? 'unpaid' : 'paid'

    const { error } = await supabase
      .from('service_bookings')
      .update({ payment_status: nextPaymentStatus })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw error

    setBookings(prev =>
      prev.map(b =>
        b.id === id ? { ...b, payment_status: nextPaymentStatus } : b,
      ),
    )
  } catch (e: unknown) {
    console.error(e)
    const message =
      e instanceof Error ? e.message : 'Errore aggiornamento pagamento.'
    setError(message)
  } finally {
    setSavingAction(false)
  }
}

async function deleteBooking(id: string) {
  const ok = window.confirm('Vuoi eliminare definitivamente questa prenotazione?')
  if (!ok) return

  try {
    setSavingAction(true)

    const { error } = await supabase
      .from('service_bookings')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw error

    setBookings(prev => prev.filter(b => b.id !== id))
    setDrawerOpen(false)
    setSelectedBookingId(null)
  } catch (e: unknown) {
    console.error(e)
    const message =
      e instanceof Error ? e.message : 'Errore eliminazione prenotazione.'
    setError(message)
  } finally {
    setSavingAction(false)
  }
}
async function markBookingSeen(id: string) {
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('service_bookings')
    .update({ manager_seen_at: now })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) throw error

  setBookings(prev =>
    prev.map(b => (b.id === id ? { ...b, manager_seen_at: now } : b)),
  )
}
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
        const { data: tenantRow } = await supabase
  .from('tenants')
  .select('name')
  .eq('id', tenantId)
  .maybeSingle()

if (!cancelled) setTenantName(tenantRow?.name || '')
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
  'id, tenant_id, service_id, staff_id, customer_name, customer_phone, customer_email, note, booking_date, booking_time, status, payment_status, created_at, manager_seen_at, checkout_pending',
)
          .eq('tenant_id', tenantId)
          .eq('checkout_pending', false)
          .gte('booking_date', start)
          .lte('booking_date', end)
          .order('booking_date', { ascending: true })
          .order('booking_time', { ascending: true })

        if (bErr) throw bErr
        if (!cancelled) {
          const normalizedBookings = ((bRows || []) as Array<Booking & { payment_status?: 'unpaid' | 'paid' | null }>).map(
            b => ({
              ...b,
              payment_status: b.payment_status ?? 'unpaid',
              created_at: b.created_at || '',
            }),
          ) as Booking[]
          setBookings(normalizedBookings)
        }
      } catch (e: unknown) {
        console.error(e)
        if (!cancelled) {
          const message =
            e instanceof Error ? e.message : 'Errore nel caricamento del calendario.'
          setError(message)
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
const calendarRowHeight = calendarExpanded ? 20 : 28
const calendarBookingHeightGap = calendarExpanded ? 4 : 6
 return (
  <main className="min-h-[calc(100vh-72px)] overflow-x-hidden bg-[#F2F4F7] px-4 py-3 pb-24 text-[#0F1D2D] md:px-6 md:pb-6 xl:h-[calc(100vh-72px)] xl:overflow-hidden xl:pb-3">
    <div className="mx-auto grid max-w-7xl gap-3">
      {/* HEADER PAGINA */}
     <header className="grid gap-3">
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="hidden md:block text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
    Area gestore
  </p>

  <h1 className="hidden md:block text-3xl font-black tracking-tight text-[#0F1D2D]">
    Calendario
  </h1>

  <p className="text-sm text-slate-600">
    Visualizza gli appuntamenti della settimana.
  </p>
</div>
  </div>
</header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* INFO SETTIMANA MOBILE */}
<div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:hidden">
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        Settimana
      </p>

      <p className="mt-1 truncate font-black text-[#0F1D2D]">{weekLabel}</p>
    </div>

    <button
      type="button"
      onClick={() => setMobileFiltersOpen(v => !v)}
      className={[
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-xl shadow-sm transition active:scale-[0.98]',
        mobileFiltersOpen
          ? 'border-[#1FA7A6]/30 bg-[#E6FFFA] text-[#0F766E]'
          : 'border-slate-200 bg-[#F8FAFC] text-[#0F1D2D]',
      ].join(' ')}
      aria-label="Apri filtri calendario"
      title="Filtri"
    >
      🔎
    </button>
  </div>

  <div className="mt-4 flex items-center gap-2">
    <button
      type="button"
      onClick={goPrevWeek}
      className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition active:scale-[0.98]"
    >
      ←
    </button>

    <button
      type="button"
      onClick={() => setWeekStart(dateToYMD(getMonday(new Date())))}
      className="flex-[2] rounded-2xl bg-[#FFC145] px-3 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition active:scale-[0.98]"
    >
      Questa settimana
    </button>

    <button
      type="button"
      onClick={goNextWeek}
      className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition active:scale-[0.98]"
    >
      →
    </button>
  </div>
</div>

      {/* FILTRI MOBILE */}
      <div
        className={[
          mobileFiltersOpen ? 'grid' : 'hidden',
          'gap-3 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm md:hidden',
        ].join(' ')}
      >
        <div className="grid gap-1 text-sm">
          <label className="font-bold text-[#0F1D2D]">Cerca cliente</label>
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Es. Marco"
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
          />
        </div>

        <div className="grid gap-1 text-sm">
          <label className="font-bold text-[#0F1D2D]">Stato</label>
          <select
            value={statusFilter}
            onChange={e =>
              setStatusFilter(
                e.target.value as 'all' | 'pending' | 'confirmed' | 'cancelled',
              )
            }
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
          >
            <option value="all">Tutti gli stati</option>
            <option value="pending">In attesa</option>
            <option value="confirmed">Confermate</option>
            <option value="cancelled">Cancellate</option>
          </select>
        </div>

        <div className="grid gap-1 text-sm">
          <label className="font-bold text-[#0F1D2D]">Operatore</label>
          <select
            value={staffFilter}
            onChange={e => setStaffFilter(e.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
          >
            <option value="all">Tutti gli operatori</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('all')
            setStaffFilter('all')
            setSearchTerm('')
            setMobileFiltersOpen(false)
          }}
          className="text-left text-sm font-bold text-[#1FA7A6] underline underline-offset-4"
        >
          Azzera filtri
        </button>
      </div>

      {/* CALENDARIO MOBILE STILE APP - compatto */}
<div className="md:hidden overflow-hidden rounded-[2rem] border border-slate-200 bg-[#EEF2F7] shadow-sm">
  <div className="max-h-[calc(100vh-310px)] overflow-y-auto overflow-x-hidden p-2 pb-28">
    <div className="grid w-full grid-cols-[50px_repeat(7,minmax(0,1fr))] gap-[3px] text-xs">
      {/* Angolo Ora */}
      <div className="sticky left-0 top-0 z-30 rounded-xl bg-[#EEF2F7] px-2 py-2 text-left text-xs font-black text-slate-400">
        Ora
      </div>

      {/* Header giorni */}
      {weekDays.map((d, idx) => (
        <div
          key={d}
          className="sticky top-0 z-20 rounded-xl bg-[#EEF2F7] px-2 py-2 text-center"
        >
          <div className="text-[11px] font-black uppercase text-slate-500">
            {DOW_LABELS[idx]}
          </div>

          <div className="text-xl font-black leading-tight text-[#0F1D2D]">
            {new Date(`${d}T00:00:00`).getDate()}
          </div>
        </div>
      ))}

      {/* Righe calendario */}
      {timeSlots.map(time => {
        const isFullHour = time.endsWith(':00')

        return (
          <Fragment key={time}>
            {/* Colonna orari fissa */}
            <div
              className={[
                'sticky left-0 z-10 flex h-10 items-start justify-end rounded-xl bg-[#EEF2F7] px-2 pt-1 font-black',
                isFullHour ? 'text-slate-600' : 'text-transparent',
              ].join(' ')}
            >
              {time}
            </div>

            {weekDays.map(day => {
              const key = `${day}__${time}`

              if (occupiedCells.has(key)) {
                return (
                  <div
                    key={key}
                    className="h-10 rounded-xl bg-white/70"
                  />
                )
              }

              const list = bookingsByDayTime[key] || []

              return (
                <div
                  key={key}
                  className="relative h-10 rounded-xl bg-white/90 p-0.5"
                >
                  {list.length > 0 ? (
                    <div
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {list.map(b => {
  const svc = serviceById[b.service_id]
  const visual = calendarBookingVisual(b)
  const duration = svc?.duration_minutes || 30
  const span = Math.max(
    1,
    Math.ceil(duration / slotStepMinutes),
  )

  return (
    <button
      key={b.id}
      type="button"
      onClick={() => openDrawer(b.id)}
      className={[
        'relative z-10 w-full overflow-hidden rounded-lg border shadow-sm transition active:scale-[0.98]',
        visual.cls,
      ].join(' ')}
      style={{
        height: `${span * 40 - 4}px`,
      }}
      title={`${b.customer_name} · ${svc?.name || 'Servizio'} · ${fmtTime(
        b.booking_time,
      )}`}
    />
  )
})}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </Fragment>
        )
      })}
    </div>
  </div>
</div>

      {/* DESKTOP LAYOUT */}
      <div className="hidden md:grid md:grid-cols-[280px_minmax(0,1fr)] md:items-start md:gap-5">
       {/* SIDEBAR FILTRI */}
<aside className="sticky top-24 grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
              Settimana
            </p>
            <p className="mt-1 text-lg font-black text-[#0F1D2D]">
              {weekLabel}
            </p>
          </div>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={goPrevWeek}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
            >
              ← Settimana precedente
            </button>

            <button
              type="button"
              onClick={() => setWeekStart(dateToYMD(getMonday(new Date())))}
              className="rounded-2xl bg-[#FFC145] px-3 py-2 text-sm font-black text-[#0F1D2D] transition hover:brightness-95"
            >
              Torna a oggi
            </button>

            <button
              type="button"
              onClick={goNextWeek}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
            >
              Settimana successiva →
            </button>
          </div>

          <div className="h-px bg-slate-100" />

          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
              Filtri
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Affina la vista del calendario.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1 text-sm">
              <label className="font-bold text-[#0F1D2D]">Cerca cliente</label>
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Es. Marco"
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
              />
            </div>

            <div className="grid gap-1 text-sm">
              <label className="font-bold text-[#0F1D2D]">Stato</label>
              <select
                value={statusFilter}
                onChange={e =>
                  setStatusFilter(
                    e.target.value as 'all' | 'pending' | 'confirmed' | 'cancelled',
                  )
                }
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
              >
                <option value="all">Tutti gli stati</option>
                <option value="pending">In attesa</option>
                <option value="confirmed">Confermate</option>
                <option value="cancelled">Cancellate</option>
              </select>
            </div>

            <div className="grid gap-1 text-sm">
              <label className="font-bold text-[#0F1D2D]">Operatore</label>
              <select
                value={staffFilter}
                onChange={e => setStaffFilter(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
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
            <div className="text-xs font-bold text-slate-500">
              {filteredBookings.length}/{bookings.length} visibili
            </div>

            <button
              type="button"
              onClick={() => {
                setStatusFilter('all')
                setStaffFilter('all')
                setSearchTerm('')
              }}
              className="text-sm font-bold text-[#1FA7A6] underline underline-offset-4"
            >
              Azzera
            </button>
          </div>
        </aside>

        {/* CALENDARIO DESKTOP */}
        <section
  className={[
    'flex flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-[11px] shadow-sm',
    calendarExpanded
      ? 'fixed left-4 right-4 bottom-4 top-[76px] z-40'
      : '',
  ].join(' ')}
>
         <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-[#F8FAFC] px-5 py-4">
  <div>
    <p className="text-sm font-black text-[#0F1D2D]">Vista settimanale</p>
    <p className="mt-0.5 text-xs font-medium text-slate-500">
      Clicca su un appuntamento per aprire il dettaglio.
    </p>
  </div>

  <button
    type="button"
    onClick={() => setCalendarExpanded(prev => !prev)}
    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg font-black text-[#0F1D2D] shadow-sm transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
    title={calendarExpanded ? 'Riduci calendario' : 'Apri calendario grande'}
    aria-label={calendarExpanded ? 'Riduci calendario' : 'Apri calendario grande'}
  >
    {calendarExpanded ? '×' : '⛶'}
  </button>
</div>

          <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-white px-5 py-3 text-[11px] font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-amber-300 bg-amber-100" />
              In attesa
            </span>

            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-emerald-300 bg-emerald-100" />
              Pagata
            </span>

            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-emerald-300 bg-[linear-gradient(135deg,#D1FAE5_0%,#D1FAE5_50%,#FEF3C7_50%,#FEF3C7_100%)]" />
              Da pagare
            </span>

            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-red-300 bg-red-100" />
              Cancellata
            </span>
          </div>


         <div
className={
  calendarExpanded
    ? 'min-h-0 flex-1 overflow-hidden'
    : 'overflow-x-auto overflow-y-visible xl:max-h-[calc(100vh-190px)] xl:overflow-y-auto xl:overflow-x-hidden'
}
>
  <table className="w-full table-fixed border-collapse">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="text-xs font-black uppercase tracking-wide text-slate-400">
                  <th className="w-16 border-b border-r border-slate-100 bg-[#F8FAFC] px-2 py-2.5 text-left">
                    Ora
                  </th>
                  {weekDays.map((d, idx) => (
                    <th
                      key={d}
                      className="border-b border-r border-slate-100 bg-[#F8FAFC] px-2 py-2.5 text-left last:border-r-0"
                    >
                      <div className="text-[#0F1D2D]">
                        {DOW_LABELS[idx]}
                      </div>
                      <div className="text-xs font-bold text-slate-400">
                        {fmtDateShort(d)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {timeSlots.map(time => (
                  <tr
  key={time}
  style={{ height: `${calendarRowHeight}px` }}
>
                    <td className="whitespace-nowrap border-r border-t border-slate-100 bg-[#F8FAFC] px-2 py-0.5 text-right align-middle text-[11px] font-bold text-slate-400">
                      {time}
                    </td>

                    {weekDays.map(day => {
  const key = `${day}__${time}`

  if (occupiedCells.has(key)) {
    return null
  }

  const list = bookingsByDayTime[key] || []

  const rowSpan =
    list.length > 0
      ? Math.max(
          ...list.map(b => {
            const svc = serviceById[b.service_id]
            return Math.max(
              1,
              Math.ceil((svc?.duration_minutes || 30) / slotStepMinutes),
            )
          }),
        )
      : 1

  return (
    <td
      key={day}
      rowSpan={rowSpan}
      className="border-r border-t border-slate-100 px-1 py-0.5 align-top last:border-r-0"
    >
      <div
        className="grid gap-1"
        style={{
  minHeight: `${rowSpan * calendarRowHeight - 4}px`,
  gridTemplateColumns:
    list.length > 1
      ? `repeat(${list.length}, minmax(0, 1fr))`
      : '1fr',
}}
      >
        {list.map(b => {
          const svc = serviceById[b.service_id]
const span = Math.max(
  1,
  Math.ceil((svc?.duration_minutes || 30) / slotStepMinutes),
)
const visual = calendarBookingVisual(b)
          return (
            <div
              key={b.id}
              role="button"
              tabIndex={0}
              onClick={() => openDrawer(b.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openDrawer(b.id)
                }
              }}
              className={[
  'relative w-full cursor-pointer overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-[1px] hover:shadow-md',
  visual.cls,
].join(' ')}
style={{
  height: `${span * calendarRowHeight - calendarBookingHeightGap}px`,
}}
            >
             
            </div>
          )
        })}
      </div>
    </td>
  )
})}                       
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
 </div>
<BookingDrawer
  open={drawerOpen}
  booking={selectedBooking}
  service={selectedService}
  staffName={selectedStaffName}
  businessName={tenantName || 'il salone'}
  onClose={closeDrawer}
  onUpdateStatus={updateStatus}
  onTogglePaid={togglePaid}
  onDeleteBooking={deleteBooking}
  onMarkSeen={markBookingSeen}
/>
  </main>
)
}