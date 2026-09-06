'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { isStaffOverlapError } from '@/lib/bookingConflict'
import type {
  Booking,
  Service,
  Staff,
  HoursRow,
  BookingSettings,
} from './types'
import {
  timeStrToMinutes,
  minutesToTime,
  todayIso,
  nowMinutes,
  overlaps,
} from './utils/booking-format'
import { NewBookingModal } from './components/NewBookingModal'
import { BookingDrawer } from './components/BookingDrawer'
import { BookingFilters } from './components/BookingFilters'
import { BookingsListHeader } from './components/BookingsListHeader'
import { BookingMobileCards } from './components/BookingMobileCards'
import { BookingsTable } from './components/BookingsTable'
import { BookingsPageHeader } from './components/BookingsPageHeader'

async function updateAppBadge(count: number) {
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (contents?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }

    if (count > 0 && nav.setAppBadge) {
      await nav.setAppBadge(count)
      return
    }

    if (count === 0 && nav.clearAppBadge) {
      await nav.clearAppBadge()
    }
  } catch {
    // Badge non supportato dal browser/dispositivo: ignora
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

export default function ServiceBookingsClient({ tenantId }: { tenantId: string }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staffNameById, setStaffNameById] = useState<Record<string, string>>({})
const [soundEnabled, setSoundEnabled] = useState(false)
const [soundReady, setSoundReady] = useState(false)

const [notificationsSupported, setNotificationsSupported] = useState(false)
const [notificationsEnabled, setNotificationsEnabled] = useState(false)
const [tenantName, setTenantName] = useState('')
const soundEnabledRef = useRef(false)
const soundReadyRef = useRef(false)
  const [staffRows, setStaffRows] = useState<Staff[]>([])
const [tenantHours, setTenantHours] = useState<HoursRow[]>([])
const [bookingSettings, setBookingSettings] = useState<BookingSettings>({
  slot_minutes: 30,
  lead_minutes: 0,
  service_staff_count: 1,
})
const [newBookingOpen, setNewBookingOpen] = useState(false)
const [newBookingSaving, setNewBookingSaving] = useState(false)
const [newBookingServiceId, setNewBookingServiceId] = useState('')
const [newBookingStaffId, setNewBookingStaffId] = useState('')
const [newBookingDate, setNewBookingDate] = useState(() =>
  new Date().toISOString().slice(0, 10),
)
const [newBookingTime, setNewBookingTime] = useState('09:00')
const [newCustomerName, setNewCustomerName] = useState('')
const [newCustomerPhone, setNewCustomerPhone] = useState('')
const [newCustomerEmail, setNewCustomerEmail] = useState('')
const [newBookingNote, setNewBookingNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)

  const [onlyPending, setOnlyPending] = useState(false)
  const [onlyUnpaid, setOnlyUnpaid] = useState(false)
  const [dateFilter, setDateFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([])
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

useEffect(() => {
  const saved = localStorage.getItem('slotta_sound_enabled')
  const enabled = saved === 'true'

  setSoundEnabled(enabled)
  setSoundReady(enabled)
}, [])
useEffect(() => {
  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  setNotificationsSupported(supported)

  if (!supported) return

  ;(async () => {
    try {
      if (Notification.permission !== 'granted') {
        setNotificationsEnabled(false)
        return
      }

      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()

      setNotificationsEnabled(!!subscription)
    } catch {
      setNotificationsEnabled(false)
    }
  })()
}, [])
useEffect(() => {
  soundEnabledRef.current = soundEnabled
  soundReadyRef.current = soundReady
}, [soundEnabled, soundReady])
function toggleSound() {
  const next = !soundEnabled

  setSoundEnabled(next)
  setSoundReady(next)
  localStorage.setItem('slotta_sound_enabled', String(next))

  if (next) {
    const audio = new Audio('/sounds/new-booking.mp3')
    audio.volume = 0.45
    audio.play().catch(() => null)
  }
}

function playNewBookingSound() {
  if (!soundEnabledRef.current || !soundReadyRef.current) return

  const audio = new Audio('/sounds/new-booking.mp3')
  audio.volume = 0.55
  audio.play().catch(() => null)
}

async function enableNotifications() {
  try {
    if (
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      alert('Le notifiche push non sono supportate su questo dispositivo o browser.')
      return
    }

    const permission = await Notification.requestPermission()

    if (permission !== 'granted') {
      setNotificationsEnabled(false)
      alert('Notifiche non autorizzate.')
      return
    }

    const registration = await navigator.serviceWorker.register('/sw.js')

    await registration.update()

const existingSubscription =
  await registration.pushManager.getSubscription()

if (existingSubscription) {
  await existingSubscription.unsubscribe()
}

const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  ),
})

 const {
  data: { session },
} = await supabase.auth.getSession()

if (!session?.access_token) {
  throw new Error('Sessione non valida per attivare le notifiche.')
}

const res = await fetch('/api/push/subscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    tenant_id: tenantId,
    subscription,
  }),
})

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data?.error || 'Errore attivazione notifiche.')
    }

   setNotificationsEnabled(true)
 } catch (e: unknown) {
  console.error(e)
  const message =
    e instanceof Error
      ? e.message
      : 'Errore durante l’attivazione delle notifiche push.'
  alert(message)
}
}
async function disableNotifications() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotificationsEnabled(false)
      return
    }

    const registration = await navigator.serviceWorker.getRegistration('/sw.js')

    if (registration) {
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
      }
    }

    setNotificationsEnabled(false)
} catch (e: unknown) {
  console.error(e)
  const message =
    e instanceof Error
      ? e.message
      : 'Errore durante la disattivazione delle notifiche.'
  alert(message)
}
}

async function toggleNotifications() {
  if (notificationsEnabled) {
    await disableNotifications()
    return
  }

  await enableNotifications()
}
  const loadBookingsData = useCallback(async (silent = false) => {
  if (!tenantId) return

  if (!silent) {
    setLoading(true)
  }

  setError(null)

try {
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle()

  setTenantName(tenantRow?.name || '')

  const { data: svcRows, error: svcErr } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price_cents')
    .eq('tenant_id', tenantId)

  if (svcErr) throw svcErr
  setServices((svcRows || []) as Service[])

      const { data: staffRowsData, error: staffErr } = await supabase
  .from('staff_members')
  .select('id, name, is_active')
  .eq('tenant_id', tenantId)
  .order('name', { ascending: true })

      if (staffErr) throw staffErr

      const activeStaff = ((staffRowsData || []) as Staff[]).filter(s => s.is_active !== false)
setStaffRows(activeStaff)

const map: Record<string, string> = {}
activeStaff.forEach((s: Staff) => {
  map[s.id] = s.name
})
setStaffNameById(map)
const { data: hoursRows, error: hoursErr } = await supabase
  .from('tenant_hours')
  .select(
    'dow, open_time_am, close_time_am, pm_enabled, open_time_pm, close_time_pm, is_closed',
  )
  .eq('tenant_id', tenantId)

if (hoursErr) throw hoursErr
setTenantHours((hoursRows || []) as HoursRow[])

const { data: settingsRow, error: settingsErr } = await supabase
  .from('tenant_settings')
  .select('slot_minutes, lead_minutes, service_staff_count')
  .eq('tenant_id', tenantId)
  .maybeSingle()

if (settingsErr) throw settingsErr

setBookingSettings({
  slot_minutes: settingsRow?.slot_minutes ?? 30,
  lead_minutes: settingsRow?.lead_minutes ?? 0,
  service_staff_count: settingsRow?.service_staff_count ?? 1,
})
      const { data: bRows, error: bErr } = await supabase
  .from('service_bookings')
  .select(
  'id, tenant_id, service_id, staff_id, customer_name, customer_phone, customer_email, booking_date, booking_time, note, status, payment_status, manager_seen_at, checkout_pending, created_at',
)
  .eq('tenant_id', tenantId)
  .eq('checkout_pending', false)
  .order('booking_date', { ascending: true })
  .order('booking_time', { ascending: true })
  .order('created_at', { ascending: true })

      if (bErr) throw bErr
      setBookings((bRows || []) as Booking[])
} catch (e: unknown) {
  console.error(e)
  const message =
    e instanceof Error
      ? e.message
      : 'Errore nel caricamento delle prenotazioni.'
  setError(message)
} finally {
  if (!silent) {
    setLoading(false)
  }
}
  }, [tenantId])

useEffect(() => {
  if (!tenantId) return
  loadBookingsData()
}, [tenantId, loadBookingsData])

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
      async payload => {
        const isNewBooking = payload.eventType === 'INSERT'
        const newRow = payload.new as Booking | null

 const shouldNotify =
  isNewBooking &&
  newRow?.status === 'pending' &&
  newRow?.checkout_pending !== true
if (shouldNotify) {
  playNewBookingSound()
}

await loadBookingsData(true)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [tenantId, loadBookingsData])

  const filteredBookings = useMemo(() => {
 let list = bookings.filter(b => b.checkout_pending !== true)
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
       const pendingBadgeCount = useMemo(() => {
  return bookings.filter(
    b => b.status === 'pending' && b.checkout_pending !== true,
  ).length
}, [bookings])

        useEffect(() => {
          updateAppBadge(pendingBadgeCount)
        }, [pendingBadgeCount])
          function setToday() {
            const d = new Date()
            setDateFilter(d.toISOString().slice(0, 10))
          }

          function setTomorrow() {
            const d = new Date()
            d.setDate(d.getDate() + 1)
            setDateFilter(d.toISOString().slice(0, 10))
          }

async function sendBookingEmail(
  bookingId: string,
  type: 'confirmed' | 'cancelled' | 'manual_created',
) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('Sessione admin non valida.')
    }

    const res = await fetch('/api/admin/booking-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        booking_id: bookingId,
        type,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data?.error || 'Errore invio email.')
    }
  } catch (e) {
    console.error('Errore invio email prenotazione:', e)
  }
}

async function updateStatus(id: string, status: Booking['status']) {
  const booking = bookings.find(b => b.id === id)

  if (!booking) return

  const previousStatus = booking.status

  if (previousStatus === status) {
    return
  }

  const { error } = await supabase
    .from('service_bookings')
    .update({ status })
    .eq('id', id)

  if (error) {
    setError(
      isStaffOverlapError(error)
        ? 'Operatore già occupato in questo orario. Aggiorna gli slot e riprova.'
        : error.message || 'Errore aggiornamento prenotazione.',
    )
    return
  }

  setBookings(prev => prev.map(b => (b.id === id ? { ...b, status } : b)))

  if (previousStatus !== 'confirmed' && status === 'confirmed') {
    await sendBookingEmail(id, 'confirmed')
  }

  if (previousStatus !== 'cancelled' && status === 'cancelled') {
    await sendBookingEmail(id, 'cancelled')
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
  const availableSlots = useMemo(() => {
  if (!newBookingServiceId || !newBookingDate) return []

  const service = serviceById[newBookingServiceId]
  if (!service) return []

  const dow = new Date(`${newBookingDate}T00:00:00`).getDay()
  const dayHours = tenantHours.find(h => h.dow === dow)

  if (!dayHours || dayHours.is_closed) return []

  const duration = service.duration_minutes || 60
  const step = Math.max(5, bookingSettings.slot_minutes || 30)

  const segments: Array<{ start: number; end: number }> = []

  const amStart = timeStrToMinutes(dayHours.open_time_am || '')
  const amEnd = timeStrToMinutes(dayHours.close_time_am || '')

  if (dayHours.open_time_am && dayHours.close_time_am && amEnd > amStart) {
    segments.push({ start: amStart, end: amEnd })
  }

  if (dayHours.pm_enabled) {
    const pmStart = timeStrToMinutes(dayHours.open_time_pm || '')
    const pmEnd = timeStrToMinutes(dayHours.close_time_pm || '')

    if (dayHours.open_time_pm && dayHours.close_time_pm && pmEnd > pmStart) {
      segments.push({ start: pmStart, end: pmEnd })
    }
  }

  const sameDayBookings = bookings.filter(
    b => b.booking_date === newBookingDate && b.status !== 'cancelled',
  )

  const isToday = newBookingDate === todayIso()
  const minStart = isToday
    ? nowMinutes() + (bookingSettings.lead_minutes || 0)
    : 0

  const result: string[] = []

  for (const segment of segments) {
    for (let start = segment.start; start + duration <= segment.end; start += step) {
      if (start < minStart) continue

      const end = start + duration

      const overlappingBookings = sameDayBookings.filter(b => {
        const bService = serviceById[b.service_id]
        const bStart = timeStrToMinutes(b.booking_time)
        const bEnd = bStart + (bService?.duration_minutes || 60)

        if (!overlaps(start, end, bStart, bEnd)) return false

        if (newBookingStaffId) {
          return b.staff_id === newBookingStaffId
        }

        return true
      })

      if (newBookingStaffId) {
        if (overlappingBookings.length === 0) {
          result.push(minutesToTime(start))
        }
      } else {
        const capacity = Math.max(1, bookingSettings.service_staff_count || 1)

        if (overlappingBookings.length < capacity) {
          result.push(minutesToTime(start))
        }
      }
    }
  }

  return result
}, [
  newBookingServiceId,
  newBookingDate,
  newBookingStaffId,
  tenantHours,
  bookingSettings,
  bookings,
  serviceById,
])

useEffect(() => {
  if (!newBookingOpen) return

  if (availableSlots.length === 0) {
    setNewBookingTime('')
    return
  }

  if (!availableSlots.includes(newBookingTime)) {
    setNewBookingTime(availableSlots[0])
  }
}, [availableSlots, newBookingOpen, newBookingTime])
async function createManualBooking() {
  if (!tenantId) return

  const serviceId = newBookingServiceId.trim()
  const customerName = newCustomerName.trim()
  const bookingDate = newBookingDate.trim()
  const bookingTime = newBookingTime.trim()

  if (!serviceId) {
    setError('Seleziona un servizio.')
    return
  }

  if (!customerName) {
    setError('Inserisci il nome del cliente.')
    return
  }

  if (!bookingDate) {
    setError('Seleziona una data.')
    return
  }

  if (!bookingTime) {
    setError('Seleziona un orario.')
    return
  }

  if (!availableSlots.includes(bookingTime)) {
    setError('Orario non disponibile. Seleziona un altro slot.')
    return
  }

  setNewBookingSaving(true)
  setError(null)

  try {
    const payload = {
      tenant_id: tenantId,
      service_id: serviceId,
      staff_id: newBookingStaffId || null,
      customer_name: customerName,
      customer_phone: newCustomerPhone.trim() || null,
      customer_email: newCustomerEmail.trim() || null,
      booking_date: bookingDate,
      booking_time: bookingTime.length === 5 ? `${bookingTime}:00` : bookingTime,
      note: newBookingNote.trim() || null,
      status: 'confirmed',
      payment_status: 'unpaid',
    }

    const { data, error } = await supabase
      .from('service_bookings')
      .insert(payload)
      .select(
        'id, tenant_id, service_id, staff_id, customer_name, customer_phone, customer_email, booking_date, booking_time, note, status, payment_status, created_at',
      )
      .single()

    if (error) throw error

   // EMAIL DI CONFERMA PER PRENOTAZIONE MANUALE
try {
  if (data?.id) {
    await sendBookingEmail(data.id, 'manual_created')
  }
} catch (emailErr) {
  console.error('Errore invio email prenotazione manuale:', emailErr)
}
    await loadBookingsData(true)

    setNewBookingOpen(false)
    setNewBookingServiceId('')
    setNewBookingStaffId('')
    setNewBookingDate(new Date().toISOString().slice(0, 10))
    setNewBookingTime('09:00')
    setNewCustomerName('')
    setNewCustomerPhone('')
    setNewCustomerEmail('')
    setNewBookingNote('')
} catch (e: unknown) {
  console.error(e)
  const message =
    isStaffOverlapError(e)
      ? 'Operatore già occupato in questo orario. Aggiorna gli slot e riprova.'
      : e instanceof Error
        ? e.message
        : 'Errore creazione appuntamento.'
  setError(message)
} finally {
    setNewBookingSaving(false)
  }
}
const selectedSet = useMemo(() => {
  return new Set(selectedBookingIds)
}, [selectedBookingIds])

function toggleSelectedBooking(id: string) {
  setSelectedBookingIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
  )
}

function toggleAllVisibleBookings() {
  const visibleIds = filteredBookings.map(b => b.id)

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every(id => selectedSet.has(id))

  if (allVisibleSelected) {
    setSelectedBookingIds(prev => prev.filter(id => !visibleIds.includes(id)))
  } else {
    setSelectedBookingIds(prev => Array.from(new Set([...prev, ...visibleIds])))
  }
}

async function deleteSelectedBookings() {
  if (selectedBookingIds.length === 0) return

  const ok = confirm(
    `Vuoi eliminare definitivamente ${selectedBookingIds.length} prenotazion${
      selectedBookingIds.length === 1 ? 'e' : 'i'
    } selezionat${selectedBookingIds.length === 1 ? 'a' : 'e'}?`,
  )

  if (!ok) return

  try {
    const idsToDelete = [...selectedBookingIds]

    const { error } = await supabase
      .from('service_bookings')
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', idsToDelete)

    if (error) throw error

    setBookings(prev => prev.filter(b => !idsToDelete.includes(b.id)))
    setSelectedBookingIds([])
} catch (e: unknown) {
  console.error(e)
  const message =
    e instanceof Error
      ? e.message
      : 'Errore eliminando le prenotazioni selezionate.'
  setError(message)
}
}
  return (
  <main className="min-h-screen bg-[#F2F4F7] px-4 py-5 text-[#0F1D2D] sm:px-6">
    <div className="mx-auto grid max-w-7xl gap-5">
      {/* HEADER PAGINA */}
      <BookingsPageHeader
  soundEnabled={soundEnabled}
  notificationsSupported={notificationsSupported}
  notificationsEnabled={notificationsEnabled}
  onToggleSound={toggleSound}
  onToggleNotifications={toggleNotifications}
  onNewBooking={() => {
    setNewBookingServiceId(services[0]?.id || '')
    setNewBookingStaffId('')
    setNewBookingDate(new Date().toISOString().slice(0, 10))
    setNewBookingTime('')
    setNewCustomerName('')
    setNewCustomerPhone('')
    setNewCustomerEmail('')
    setNewBookingNote('')
    setNewBookingOpen(true)
  }}
/>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <BookingFilters
  searchTerm={searchTerm}
  dateFilter={dateFilter}
  onlyPending={onlyPending}
  onlyUnpaid={onlyUnpaid}
  mobileFiltersOpen={mobileFiltersOpen}
  setSearchTerm={setSearchTerm}
  setDateFilter={setDateFilter}
  setOnlyPending={setOnlyPending}
  setOnlyUnpaid={setOnlyUnpaid}
  setMobileFiltersOpen={setMobileFiltersOpen}
  onToday={setToday}
  onTomorrow={setTomorrow}
  onReset={() => {
    setDateFilter('')
    setOnlyPending(false)
    setOnlyUnpaid(false)
    setSearchTerm('')
    setMobileFiltersOpen(false)
  }}
/>     

      {/* LISTA */}
<section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
  <BookingsListHeader
    dateFilter={dateFilter}
    resultsCount={filteredBookings.length}
    selectedCount={selectedBookingIds.length}
    onDeleteSelected={deleteSelectedBookings}
  />

        {/* MOBILE CARDS */}
        <BookingMobileCards
  loading={loading}
  bookings={filteredBookings}
  serviceById={serviceById}
  staffNameById={staffNameById}
  selectedSet={selectedSet}
  onToggleSelected={toggleSelectedBooking}
  onOpenBooking={id => {
    setSelectedBookingId(id)
    setDrawerOpen(true)
  }}
/>

        {/* DESKTOP TABLE */}
      <BookingsTable
  loading={loading}
  bookings={filteredBookings}
  serviceById={serviceById}
  staffNameById={staffNameById}
  selectedSet={selectedSet}
  allVisibleSelected={
    filteredBookings.length > 0 &&
    filteredBookings.every(b => selectedSet.has(b.id))
  }
  onToggleAllVisible={toggleAllVisibleBookings}
  onToggleSelected={toggleSelectedBooking}
  onOpenBooking={id => {
    setSelectedBookingId(id)
    setDrawerOpen(true)
  }}
  onUpdateStatus={updateStatus}
  onTogglePaid={togglePaid}
/>
      </section>
{/* MODALE NUOVO APPUNTAMENTO */}
<NewBookingModal
  open={newBookingOpen}
  services={services}
  staffRows={staffRows}
  availableSlots={availableSlots}
  newBookingSaving={newBookingSaving}
  newBookingServiceId={newBookingServiceId}
  newBookingStaffId={newBookingStaffId}
  newBookingDate={newBookingDate}
  newBookingTime={newBookingTime}
  newCustomerName={newCustomerName}
  newCustomerPhone={newCustomerPhone}
  newCustomerEmail={newCustomerEmail}
  newBookingNote={newBookingNote}
  onClose={() => setNewBookingOpen(false)}
  onCreate={createManualBooking}
  setNewBookingServiceId={setNewBookingServiceId}
  setNewBookingStaffId={setNewBookingStaffId}
  setNewBookingDate={setNewBookingDate}
  setNewBookingTime={setNewBookingTime}
  setNewCustomerName={setNewCustomerName}
  setNewCustomerPhone={setNewCustomerPhone}
  setNewCustomerEmail={setNewCustomerEmail}
  setNewBookingNote={setNewBookingNote}
/>
      {/* DRAWER DETTAGLIO */}
<BookingDrawer
  open={drawerOpen}
  booking={selectedBooking}
  service={selectedService}
  staffName={selectedStaffName}
  businessName={tenantName || 'il salone'}
  onClose={() => setDrawerOpen(false)}
  onUpdateStatus={updateStatus}
  onTogglePaid={togglePaid}
  onDeleteBooking={deleteBooking}
  onMarkSeen={markBookingSeen}
/>
    </div>
  </main>
)
}
