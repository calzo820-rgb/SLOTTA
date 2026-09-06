'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  buildSegments,
  buildSlots,
  getSlotReasonLabel,
  type Slot,
  timeStrToMinutes,
} from '@/lib/bookingSlots'
import type {
  StaffMember,
  Props,
  StaffHoursRow,
  Closure,
  StaffSelectionMode,
  PaymentModeDefault,
  PaymentModeEffective,
} from './service-booking/types'
import {
  safeIsoTodayLocal,
} from './service-booking/utils'
import { BookingPageHeader } from './service-booking/BookingPageHeader'
import { CancelPaymentAlert } from './service-booking/CancelPaymentAlert'
import { ServiceSelectionStep } from './service-booking/ServiceSelectionStep'
import { MobileContactSheet } from './service-booking/MobileContactSheet'
import { DesktopContactFooter } from './service-booking/DesktopContactFooter'

// Define types for data returned from Supabase queries. These help avoid the use of
// `any` when parsing rows from the `tenant_hours`, checkout and booking endpoints.
// `TenantHoursForBooking` reflects the subset of fields used for building booking
// segments. All fields are optional because Supabase may return null or undefined.
type TenantHoursForBooking = {
  open_time_am?: string | null
  close_time_am?: string | null
  pm_enabled?: boolean | null
  has_split?: boolean | null
  open_time_pm?: string | null
  close_time_pm?: string | null
  open_time?: string | null
  close_time?: string | null
  is_closed?: boolean | null
}

// The response returned by the checkout API contains at least a URL to redirect
// the user, an optional error message and a hold identifier when Stripe holds
// are created. All properties are optional because error cases may return
// partial data.
type CheckoutData = {
  url?: string
  error?: string
  hold_id?: string
  hold_cancel_token?: string
}

// The response returned by the booking API when paying in person includes
// either a `booking_id` on success or an error message on failure.
type BookData = {
  booking_id?: string
  error?: string
}
import { MobileStepBar } from './service-booking/MobileStepBar'

export default function ServiceBookingPageClient({ tenant, services }: Props) {
  const router = useRouter()
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    services[0]?.id ?? null,
  )

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<'any' | string>('any')
  const [showStaffPicker, setShowStaffPicker] = useState(false)
const [isCancelReturn, setIsCancelReturn] = useState(false)
  const today = useMemo(() => safeIsoTodayLocal(), [])
  const [date, setDate] = useState<string>(today)
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsRefreshing, setSlotsRefreshing] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [errorSlots, setErrorSlots] = useState<string | null>(null)
  const [isClosedDay, setIsClosedDay] = useState(false)

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [email, setEmail] = useState('')
const [privacyAccepted, setPrivacyAccepted] = useState(false)

const [reviewOpen, setReviewOpen] = useState(false)
  const [contactSheetOpen, setContactSheetOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
 
  const [morningEndTime, setMorningEndTime] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)

const [paymentModeDefault, setPaymentModeDefault] =
  useState<PaymentModeDefault>('in_person')
const [paymentModeChoice, setPaymentModeChoice] =
  useState<PaymentModeEffective>('in_person')

  const [staffSelectionMode, setStaffSelectionMode] =
    useState<StaffSelectionMode>('client_choice')

 const mainColor = '#1FA7A6'

 const onlinePaymentsAvailable =
  tenant.stripe_connect_charges_enabled === true &&
  tenant.stripe_connect_payouts_enabled === true

  const mapsUrl = tenant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        tenant.address,
      )}`
    : null

  const selectedService = useMemo(() => {
    return services.find(s => s.id === selectedServiceId) || null
  }, [services, selectedServiceId])

  const durationByServiceId = useMemo(() => {
    const map: Record<string, number> = {}
    services.forEach(s => {
      map[s.id] = s.duration_minutes || 60
    })
    return map
  }, [services])

  useEffect(() => {
    function handleResize() {
      setIsDesktop(window.innerWidth >= 768)
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])
useEffect(() => {
  let alreadyRunning = false

  async function cancelAbandonedStripeHold() {
    if (alreadyRunning) return

    const holdId = sessionStorage.getItem('slotta_pending_hold_id')
    const cancelToken = sessionStorage.getItem('slotta_pending_hold_cancel_token')
    const leftForStripe = sessionStorage.getItem('slotta_left_for_stripe')

    if (!holdId || !cancelToken || leftForStripe !== '1') return

    alreadyRunning = true

// Chiudiamo subito il riepilogo e sblocchiamo il bottone,
// così al ritorno da Stripe non resta visibile la schermata di conferma.
setSubmitting(false)
setReviewOpen(false)

try {
  const res = await fetch('/api/service-checkout-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hold_id: holdId, cancel_token: cancelToken }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        console.warn(
          'Errore annullamento hold abbandonato:',
          data?.error || res.statusText,
        )
        return
      }

      console.log('Hold Stripe abbandonato annullato:', holdId)
    } catch (err) {
      console.warn('Errore annullamento hold abbandonato:', err)
    } finally {
      sessionStorage.removeItem('slotta_pending_hold_id')
      sessionStorage.removeItem('slotta_pending_hold_cancel_token')
      sessionStorage.removeItem('slotta_left_for_stripe')

      setSubmitting(false)
      setReviewOpen(false)
      alreadyRunning = false
    }
  }

  function handleReturnToPage() {
    if (document.visibilityState === 'visible') {
      cancelAbandonedStripeHold()
    }
  }

  // Importante:
  // se il browser ricarica/rimonta la pagina dopo il back da Stripe,
  // l'evento pageshow potrebbe essere già passato.
  // Quindi controlliamo subito anche al mount.
  cancelAbandonedStripeHold()

  window.addEventListener('pageshow', handleReturnToPage)
  window.addEventListener('focus', handleReturnToPage)
  document.addEventListener('visibilitychange', handleReturnToPage)

  return () => {
    window.removeEventListener('pageshow', handleReturnToPage)
    window.removeEventListener('focus', handleReturnToPage)
    document.removeEventListener('visibilitychange', handleReturnToPage)
  }
}, [])
  useEffect(() => {
    let cancelled = false

    async function loadSlots() {
      if (!tenant.id || !date) {
        setSlots([])
        return
      }

setLoadingSlots(true)
setSlotsRefreshing(true)
setErrorSlots(null)

      try {
        const configResponse = await fetch('/api/public/booking-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant_id: tenant.id, booking_date: date }),
        })
        const config = (await configResponse.json().catch(() => ({}))) as {
          error?: string
          settings?: Record<string, unknown> | null
          staff?: StaffMember[]
          tenant_hours?: TenantHoursForBooking | null
          staff_hours?: StaffHoursRow[]
          closures?: Closure[]
        }

        if (!configResponse.ok) {
          throw new Error(config.error || 'Errore caricamento disponibilità.')
        }

        const setRows = config.settings ? [config.settings] : []
        const staffRows = config.staff || []
        if (!cancelled) setStaff((staffRows || []) as StaffMember[])

        const row = setRows?.[0] as
          | {
              slot_minutes?: number | null
              service_staff_count?: number | null
              payment_mode_default?: PaymentModeDefault | null
              staff_selection_mode?: StaffSelectionMode | null
               lead_minutes?: number | null
            }
          | undefined

        const slotMinutes =
          row?.slot_minutes && row.slot_minutes > 0 ? row.slot_minutes : 30

       const leadMinutes =
  typeof row?.lead_minutes === 'number' && row.lead_minutes >= 0
    ? row.lead_minutes
    : 30

        const staffCount =
          row?.service_staff_count && row.service_staff_count > 0
            ? row.service_staff_count
            : 1

const rawPaymentMode: PaymentModeDefault =
  row?.payment_mode_default || 'in_person'

const pmode: PaymentModeDefault = onlinePaymentsAvailable
  ? rawPaymentMode
  : 'in_person'

if (!cancelled) {
  setPaymentModeDefault(pmode)

  if (pmode === 'in_person') {
    setPaymentModeChoice('in_person')
  }

  if (pmode === 'online') {
    setPaymentModeChoice('online')
  }

  if (pmode === 'client_choice') {
    setPaymentModeChoice('in_person')
  }
}

        const smode: StaffSelectionMode = row?.staff_selection_mode || 'client_choice'
        if (!cancelled) {
          setStaffSelectionMode(smode)

          if (smode === 'auto_only') {
            setSelectedStaffId('any')
            setShowStaffPicker(false)
          }
        }

        const d = new Date(`${date}T00:00:00`)
        const dow = d.getDay()
        let selectedStaffHours: StaffHoursRow | null = null

        // Cast the first tenant_hours row to TenantHoursForBooking to avoid `any`
        const r = config.tenant_hours || undefined

        if (!r || r.is_closed) {
          if (!cancelled) {
            setIsClosedDay(true)
            setSlots([])
            setLoadingSlots(false)
            setMorningEndTime(null)
          }
          return
        }

        const staffHoursRows = config.staff_hours || []
        const closureRows = config.closures || []

        const closures = (closureRows || []) as Closure[]

        if (selectedStaffId !== 'any') {
          selectedStaffHours =
            ((staffHoursRows || []) as StaffHoursRow[]).find(
              sh => sh.staff_id === selectedStaffId && sh.dow === dow,
            ) || null
        }

        if (!cancelled) setIsClosedDay(false)

        const amCloseStr = (r.close_time_am || r.close_time || '19:00:00') as string
        const normalizedMorningEnd = String(amCloseStr).slice(0, 5)
        if (!cancelled) setMorningEndTime(normalizedMorningEnd)

        const segments = buildSegments({
          selectedStaffId,
          tenantHours: r,
          selectedStaffHours,
        })

        if (segments.length === 0) {
          if (!cancelled) {
            setIsClosedDay(false)
            setSlots([])
            setLoadingSlots(false)
            setMorningEndTime(null)
          }
          return
        }

const bookedRes = await fetch('/api/public/booked-slots', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_id: tenant.id,
    booking_date: date,
    staff_id: selectedStaffId === 'any' ? null : selectedStaffId,
  }),
})

const bookedData = await bookedRes.json().catch(() => ({}))

if (!bookedRes.ok) {
  throw new Error(bookedData?.error || 'Errore caricamento prenotazioni.')
}

type BookedSlotRow = {
  service_id: string
  booking_time: string
  status: string
}

const bookings: BookedSlotRow[] = Array.isArray(bookedData.bookings)
  ? bookedData.bookings
  : []

        const intervals: { start: number; end: number }[] = []
        const fullDayStart = 0
        const fullDayEnd = 24 * 60

        closures.forEach(c => {
          const start = c.all_day
            ? fullDayStart
            : timeStrToMinutes(c.start_time || '00:00')
          const end = c.all_day
            ? fullDayEnd
            : timeStrToMinutes(c.end_time || '23:59')

          if (c.closure_type === 'salon') {
            for (let i = 0; i < staffCount; i++) {
              intervals.push({ start, end })
            }
            return
          }

          if (c.closure_type === 'staff') {
            if (selectedStaffId !== 'any' && c.staff_id === selectedStaffId) {
              for (let i = 0; i < staffCount; i++) {
                intervals.push({ start, end })
              }
              return
            }

            if (selectedStaffId === 'any') {
              intervals.push({ start, end })
            }
          }
        })

        bookings.forEach(b => {
  const start = timeStrToMinutes(b.booking_time)
  const dur = durationByServiceId[b.service_id] || 60
  const end = start + dur
  intervals.push({ start, end })
})

        const selectedDuration =
          selectedServiceId && durationByServiceId[selectedServiceId]
            ? durationByServiceId[selectedServiceId]
            : 60

        const slotsTmp = buildSlots({
          date,
          segments,
          slotMinutes,
          selectedDuration,
          intervals,
          staffCount,
          leadMinutes,
        })

        if (!cancelled) setSlots(slotsTmp)
      } catch (e: unknown) {
        if (!cancelled) {
          console.error('Errore caricamento slot servizi', {
            error: e,
            tenantId: tenant.id,
            date,
            selectedServiceId,
            selectedStaffId,
          })
          const msg = e instanceof Error ? e.message : String(e || '')
          if (msg.toLowerCase().includes('fetch failed')) {
            setErrorSlots('Errore temporaneo di connessione. Riprova tra un attimo.')
          } else {
            setErrorSlots(msg || 'Errore nel calcolo degli orari.')
          }
          setSlots([])
        }
} finally {
  if (!cancelled) {
    setLoadingSlots(false)
    setSlotsRefreshing(false)
  }
}
    }

    loadSlots()

    return () => {
      cancelled = true
    }
  }, [
    tenant.id,
    date,
    durationByServiceId,
    onlinePaymentsAvailable,
    selectedServiceId,
    selectedStaffId,
  ])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    const status = params.get('status')
    const service = params.get('service')
    const dateParam = params.get('date')
    const timeParam = params.get('time')
    const staffParam = params.get('staff')

    if (status === 'cancel') {
      setIsCancelReturn(true)

      if (service) setSelectedServiceId(service)
      if (dateParam) setDate(dateParam)
      if (timeParam) setSelectedTime(timeParam)
      // `staffParam` may be 'any' or an operator ID. Cast it to the same type
      // as selectedStaffId ('any' | string) instead of `any`.
      if (staffParam) setSelectedStaffId(staffParam as 'any' | string)
    }
  }, [])

  const effectivePaymentMode: PaymentModeEffective =
    paymentModeDefault === 'client_choice' ? paymentModeChoice : paymentModeDefault

async function submitBooking() {
  if (!tenant.id || !selectedService || !date || !selectedTime) {
    alert('Seleziona un servizio, un giorno e un orario, e inserisci il nome.')
    return
  }

  if (!isNameOk) {
    alert('Controlla il nome inserito.')
    return
  }

  if (!isPhoneOk) {
    alert('Controlla il telefono inserito.')
    return
  }

  if (!isEmailOk) {
    alert('Controlla l’email inserita.')
    return
  }

  if (!privacyAccepted) {
    alert('Devi accettare l’informativa privacy per completare la prenotazione.')
    return
  }

  const slot = slots.find(s => s.time === selectedTime)

  if (!slot || slot.disabled) {
    alert('L’orario selezionato non è disponibile.')
    return
  }

  setSubmitting(true)

  try {
    const basePayload = {
      tenant_id: tenant.id,
      service_id: selectedService.id,
      booking_date: date,
      booking_time: selectedTime,
      customer_name: name.trim(),
      customer_email: email.trim(),
      customer_phone: phone.trim(),
      note: note || null,
      staff_id: selectedStaffId === 'any' ? null : selectedStaffId,
    }

    /**
     * PAGAMENTO ONLINE
     *
     * Qui NON creiamo più la prenotazione vera.
     * Chiamiamo direttamente /api/service-checkout,
     * che crea solo l'hold temporaneo e manda il cliente su Stripe.
     */
   if (effectivePaymentMode === 'online') {
  if (!onlinePaymentsAvailable) {
    alert(
      'I pagamenti online non sono ancora disponibili per questa attività. Puoi scegliere il pagamento in salone.',
    )
    setPaymentModeChoice('in_person')
    return
  }

  const base = window.location.origin

      const successUrl = `${base}/t/${tenant.slug}/success?status=success&session_id={CHECKOUT_SESSION_ID}`

      const cancelUrl = `${base}/t/${tenant.slug}?status=cancel&service=${selectedService.id}&date=${date}&time=${selectedTime}&staff=${selectedStaffId}`

      const checkoutRes = await fetch('/api/service-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...basePayload,
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      })

      // Parse the JSON response and type it as CheckoutData. If parsing fails
      // return an empty object of type CheckoutData.
      const checkoutData: CheckoutData = await checkoutRes
        .json()
        .catch(() => ({} as CheckoutData))

      if (!checkoutRes.ok || !checkoutData?.url) {
  const msg =
    checkoutData?.error || 'Errore durante la creazione del pagamento.'

  if (
    checkoutRes.status === 409 ||
    msg.includes('Nessun operatore disponibile') ||
    msg.includes('Operatore già occupato') ||
    msg.includes('orario')
  ) {
    alert(
      'Questo orario non è più disponibile. Scegli un altro orario tra quelli aggiornati.',
    )

    setSelectedTime('')
    setReviewOpen(false)
    setSubmitting(false)
    setCurrentStep(2)

    return
  }

  throw new Error(msg)
}
if (checkoutData?.hold_id && checkoutData?.hold_cancel_token) {
  sessionStorage.setItem('slotta_pending_hold_id', checkoutData.hold_id)
  sessionStorage.setItem(
    'slotta_pending_hold_cancel_token',
    checkoutData.hold_cancel_token,
  )
  sessionStorage.setItem('slotta_left_for_stripe', '1')
}
      window.location.href = checkoutData.url
      return
    }

    /**
     * PAGAMENTO IN SALONE
     *
     * Qui la prenotazione nasce subito,
     * perché non c'è nessun pagamento Stripe da attendere.
     */
    const resBook = await fetch('/api/service-book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        payment_mode: 'in_person',
      }),
    })

    // Parse the JSON response and type it as BookData. If parsing fails
    // return an empty object of type BookData.
    const bookData: BookData = await resBook
      .json()
      .catch(() => ({} as BookData))

    if (!resBook.ok || !bookData?.booking_id) {
      const msg = bookData?.error || 'Errore nella creazione della prenotazione.'

      if (
  resBook.status === 409 ||
  msg.includes('Operatore già occupato') ||
  msg.includes('Nessun operatore disponibile') ||
  msg.includes('Nessun operatore attivo') ||
  msg.includes('Seleziona un operatore')
) {
  alert(
    'Questo orario non è più disponibile. Scegli un altro orario tra quelli aggiornati.',
  )

  setSelectedTime('')
  setReviewOpen(false)
  setSubmitting(false)
  setCurrentStep(2)

  return
}

      throw new Error(msg)
    }

    const bookingId = bookData.booking_id as string

    router.push(`/t/${tenant.slug}/success?booking=${bookingId}`)
  } catch (e: unknown) {
    console.error(e)
    const message =
      e instanceof Error
        ? e.message
        : 'Errore durante la prenotazione / pagamento.'
    alert(message)
    setSubmitting(false)
  }
}
  const isServiceSelected = !!selectedService
  const isSlotSelected = !!selectedTime
  const isNameOk = name.trim().length >= 2
const cleanPhone = phone.trim()
const isPhoneOk = cleanPhone.replace(/\D/g, '').length >= 8
const isEmailOk =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const nameError =
    name.length === 0 ? '' : name.trim().length < 2 ? 'Inserisci almeno 2 caratteri.' : ''
const phoneError =
  phone.length === 0
    ? ''
    : phone.trim().replace(/\D/g, '').length < 8
    ? 'Inserisci un numero di telefono valido.'
    : ''
 const emailError =
  email.length === 0
    ? ''
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? 'Inserisci un’email valida.'
    : ''

  const selectedSlot = slots.find(s => s.time === selectedTime)
  const isSlotValid = !!selectedSlot && !selectedSlot.disabled

  const canGoStep2 = !!selectedService
  const canGoStep3 = !!selectedTime

const canSubmit =
  isServiceSelected &&
  isSlotSelected &&
  isSlotValid &&
  isNameOk &&
  isPhoneOk &&
  isEmailOk &&
  privacyAccepted &&
  !submitting

  const buttonLabel = (() => {
    if (submitting) {
      return effectivePaymentMode === 'online' ? 'Reindirizzamento…' : 'Invio prenotazione…'
    }
    if (!isServiceSelected) return 'Scegli un servizio'
    if (!isSlotSelected) return 'Seleziona un orario'
    if (!isNameOk || !isPhoneOk) return 'Inserisci nome e telefono'
if (!isEmailOk) return 'Inserisci email'
if (!privacyAccepted) return 'Accetta la privacy'
return effectivePaymentMode === 'online' ? 'Prenota e paga ora' : 'Conferma appuntamento'
  })()

  const morningSlots = useMemo(() => {
    if (!morningEndTime) return slots
    return slots.filter(s => s.time < morningEndTime)
  }, [slots, morningEndTime])

  const afternoonSlots = useMemo(() => {
    if (!morningEndTime) return []
    return slots.filter(s => s.time >= morningEndTime)
  }, [slots, morningEndTime])

  return (
    <main className="min-h-screen bg-[#F2F4F7] pb-36 text-[#0F1D2D] md:pb-24">
      {/* HEADER */}
      <BookingPageHeader
  tenant={tenant}
  mapsUrl={mapsUrl}
  onOpenContactSheet={() => setContactSheetOpen(true)}
/>
      {/* CANCEL ALERT */}
    <CancelPaymentAlert visible={isCancelReturn} />

      {/* LAYOUT */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-5 px-4 pt-4 md:grid-cols-3 md:px-6 md:pt-6">
        {/* LEFT - SERVIZI */}
        <ServiceSelectionStep
  currentStep={currentStep}
  isDesktop={isDesktop}
  services={services}
  selectedServiceId={selectedServiceId}
  onSelectService={serviceId => {
    setSelectedServiceId(serviceId)
    setSelectedTime('')
  }}
/>
        {/* RIGHT - BOOKING PANEL */}
        {(currentStep > 1 || isDesktop) && (
          <aside className="md:sticky md:top-24 md:col-span-1">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
              <div className="grid gap-5 p-5">
                {!selectedService && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                    Seleziona un servizio dalla lista.
                  </div>
                )}

                {selectedService && (
                  <>
                    {/* STEP 2 */}
                    {(currentStep === 2 || isDesktop) && (
                      <section className="grid gap-4">
                        <div>
                          <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
                            Step 2
                          </p>
                          <h3 className="text-lg font-black text-[#0F1D2D]">
                            Giorno e orario
                          </h3>
                        </div>

                        <div className="grid gap-2">
                          <label className="text-sm font-bold text-[#0F1D2D]">
                            Giorno
                          </label>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-[#1FA7A6] focus-within:ring-2 focus-within:ring-[#1FA7A6]/10">
                            <input
                              type="date"
                              value={date}
                              min={today}
                              onChange={e => {
                                setDate(e.target.value)
                                setSelectedTime('')
                                setIsClosedDay(false)
                                setErrorSlots(null)
                              }}
                              className="w-full bg-transparent text-base outline-none md:text-sm"
                            />
                          </div>
                          <p className="text-xs text-slate-500">
                            Seleziona il giorno in cui vuoi venire.
                          </p>
                        </div>

                        {staff.length > 1 && staffSelectionMode === 'client_choice' && (
                          <div className="grid gap-2">
                            <p className="text-sm font-bold text-[#0F1D2D]">
                              Operatore
                            </p>

                            {!showStaffPicker ? (
                              <div className="grid gap-2 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
                                <p className="text-sm font-black text-[#0F1D2D]">
                                  Assegnazione automatica
                                </p>
                                <p className="text-xs leading-5 text-slate-600">
                                  Ti assegniamo automaticamente l’operatore disponibile più adatto all’orario scelto.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setShowStaffPicker(true)}
                                  className="text-left text-sm font-bold underline underline-offset-4"
                                  style={{ color: mainColor }}
                                >
                                  Preferisco scegliere io
                                </button>
                              </div>
                            ) : (
                              <div className="grid gap-2">
                                <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4">
                                  <p className="text-sm font-black text-[#0F1D2D]">
                                    Scegli il tuo operatore
                                  </p>

                                  <select
                                    value={selectedStaffId}
                                    onChange={e => {
                                      // Cast the selected value to the same union type as selectedStaffId
                                      setSelectedStaffId(e.target.value as 'any' | string)
                                      setSelectedTime('')
                                      setErrorSlots(null)
                                    }}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10 md:text-sm"
                                  >
                                    <option value="any">Assegnazione automatica</option>
                                    {staff.map(s => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                  </select>

                                  <p className="text-xs leading-5 text-slate-500">
                                    Se scegli un operatore specifico, vedrai solo gli orari disponibili per lui o lei.
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowStaffPicker(false)
                                    setSelectedStaffId('any')
                                    setSelectedTime('')
                                    setErrorSlots(null)
                                  }}
                                  className="text-left text-xs font-bold text-slate-500 underline underline-offset-4"
                                >
                                  Torna ad assegnazione automatica
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        <div
className={`grid gap-3 text-sm ${
  slotsRefreshing ? 'opacity-70' : 'opacity-100'
} transition-opacity`}
                        >
                          <div>
                            <p className="text-sm font-bold text-[#0F1D2D]">Orario</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Gli orari in grigio non sono prenotabili.
                            </p>
                          </div>

                          {errorSlots && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                              {errorSlots}
                            </div>
                          )}

                          {!loadingSlots && slots.length === 0 && !errorSlots && (
                            <div
                              className={[
                                'rounded-2xl border p-4 text-xs',
                                isClosedDay
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-900',
                              ].join(' ')}
                            >
                              <div className="font-black">
                                {isClosedDay ? 'Giorno di chiusura' : 'Nessun orario disponibile'}
                              </div>
                              <div className="mt-1 leading-5">
                                {isClosedDay
                                  ? 'Il salone è chiuso in questa data. Seleziona un altro giorno.'
                                  : 'Prova a scegliere un altro giorno.'}
                              </div>
                            </div>
                          )}

                          {morningSlots.length > 0 && (
                            <div className="grid gap-2">
                              <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                                Mattina
                              </div>

                              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
{morningSlots.map((s, index) => {
  const isDisabled = s.disabled || slotsRefreshing
  const isSelected = s.time === selectedTime && !slotsRefreshing

  return (
    <button
      key={`morning-${s.time}-${index}`}
      type="button"
      onClick={() => {
        if (isDisabled) return
        setSelectedTime(s.time)
      }}
      disabled={isDisabled}
      title={s.disabled ? getSlotReasonLabel(s.reason) : ''}
      className={[
        'flex min-h-[44px] items-center justify-center rounded-2xl border px-3 py-2 text-sm font-black transition',
        isDisabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
          : isSelected
          ? 'border-[#1FA7A6] bg-[#1FA7A6] text-white shadow-sm'
          : 'border-slate-200 bg-white text-[#0F1D2D] hover:border-[#1FA7A6] hover:text-[#1FA7A6]',
      ].join(' ')}
    >
      {s.time}
    </button>
  )
})}
                              </div>
                            </div>
                          )}

                          {afternoonSlots.length > 0 && (
                            <div className="grid gap-2">
                              <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                                Pomeriggio
                              </div>

                              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
{afternoonSlots.map((s, index) => {
  const isDisabled = s.disabled || slotsRefreshing
  const isSelected = s.time === selectedTime && !slotsRefreshing

  return (
    <button
      key={`afternoon-${s.time}-${index}`}
      type="button"
      onClick={() => {
        if (isDisabled) return
        setSelectedTime(s.time)
      }}
      disabled={isDisabled}
      title={s.disabled ? getSlotReasonLabel(s.reason) : ''}
      className={[
        'flex min-h-[44px] items-center justify-center rounded-2xl border px-3 py-2 text-sm font-black transition',
        isDisabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
          : isSelected
          ? 'border-[#1FA7A6] bg-[#1FA7A6] text-white shadow-sm'
          : 'border-slate-200 bg-white text-[#0F1D2D] hover:border-[#1FA7A6] hover:text-[#1FA7A6]',
      ].join(' ')}
    >
      {s.time}
    </button>
  )
})}
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    )}

                    {/* STEP 3 */}
                    {(currentStep === 3 || isDesktop) && (
                      <section className="grid gap-4">
                        <div className="h-px bg-slate-100" />

                        <div>
                          <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
                            Step 3
                          </p>
                          <h3 className="text-lg font-black text-[#0F1D2D]">
                            I tuoi dati
                          </h3>
                        </div>

                      <div className="grid gap-3 text-sm">
  <div className="grid gap-1">
    <label className="text-sm font-bold text-[#0F1D2D]">
      Nome *
    </label>

    <input
      value={name}
      onChange={e => setName(e.target.value)}
      placeholder="Nome e cognome"
      className="rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10 md:text-sm"
      style={{ borderColor: nameError ? '#dc2626' : undefined }}
    />

    {nameError ? (
      <div className="text-xs font-medium text-red-600">
        {nameError}
      </div>
    ) : null}
  </div>

  <div className="grid gap-1">
    <label className="text-sm font-bold text-[#0F1D2D]">
      Telefono *
    </label>

    <input
    type="tel"
      value={phone}
      onChange={e => setPhone(e.target.value)}
      placeholder="333 1234567"
      inputMode="tel"
      className="rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10 md:text-sm"
      style={{ borderColor: phoneError ? '#dc2626' : undefined }}
    />

    {phoneError ? (
      <div className="text-xs font-medium text-red-600">
        {phoneError}
      </div>
    ) : (
      <div className="text-xs text-slate-500">
        Usato solo in caso di necessità, ad esempio per variazioni di orario.
      </div>
    )}
  </div>

  <div className="grid gap-1">
    <label className="text-sm font-bold text-[#0F1D2D]">
      Email *
    </label>

<input
  type="text"
  inputMode="email"
  autoComplete="email"
  value={email}
  onChange={e => setEmail(e.target.value)}
  placeholder="nome@email.it"
  className="rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10 md:text-sm"
  style={{ borderColor: emailError ? '#dc2626' : undefined }}
/>

    {emailError ? (
      <div className="text-xs font-medium text-red-600">
        {emailError}
      </div>
    ) : (
      <div className="text-xs text-slate-500">
        Riceverai qui conferma, aggiornamenti e promemoria della prenotazione.
      </div>
    )}
  </div>

    <div className="grid gap-1">
    <label className="text-sm font-bold text-[#0F1D2D]">
      Note <span className="font-medium text-slate-400">(opzionale)</span>
    </label>

    <textarea
      value={note}
      onChange={e => setNote(e.target.value)}
      placeholder="Richieste particolari o informazioni utili…"
      className="rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10 md:text-sm"
      rows={3}
    />

    <div className="text-xs text-slate-500">
      Non inserire informazioni sanitarie o dati particolari non necessari alla prenotazione.
    </div>
  </div>

  <label className="flex gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3 text-xs leading-5 text-slate-600">
    <input
      type="checkbox"
      checked={privacyAccepted}
      onChange={e => setPrivacyAccepted(e.target.checked)}
      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
    />

    <span>
      Ho letto l{'’'}informativa privacy e acconsento al trattamento dei dati necessari
      alla gestione della prenotazione.{' '}
      <a
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold underline underline-offset-4"
        style={{ color: mainColor }}
      >
        Leggi informativa privacy
      </a>
    </span>
  </label>
</div>

                        {paymentModeDefault === 'client_choice' && (
                          <div className="mt-3 grid gap-3">
                            <div>
                              <div className="text-sm font-black text-[#0F1D2D]">
                                Pagamento
                              </div>
                              <div className="mt-1 text-xs font-medium text-slate-500">
                                Scegli come preferisci pagare l’appuntamento.
                              </div>
                            </div>

                            <div className="grid gap-2 rounded-3xl border border-slate-200 bg-[#F8FAFC] p-2">
                              <button
                                type="button"
                                onClick={() => setPaymentModeChoice('online')}
                                className={[
                                  'w-full rounded-2xl border p-3 text-left transition-all duration-200',
                                  paymentModeChoice === 'online'
                                    ? 'border-[#1FA7A6] bg-white ring-2 ring-[#1FA7A6]/10'
                                    : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-white',
                                ].join(' ')}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={[
                                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                                      paymentModeChoice === 'online'
                                        ? 'border-[#FFC145] bg-[#FFC145]'
                                        : 'border-slate-300 bg-white',
                                    ].join(' ')}
                                  >
                                    {paymentModeChoice === 'online' && (
                                      <div className="h-2 w-2 rounded-full bg-[#0F1D2D]" />
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div className="text-sm font-black text-[#0F1D2D]">
                                        Paga online ora
                                      </div>

                                      <span className="rounded-full bg-[#E6FFFA] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#0F766E]">
                                        Rapido
                                      </span>
                                    </div>

                                    <div className="mt-1 text-xs leading-5 text-slate-500">
                                      Confermi la richiesta e completi il pagamento online.
                                    </div>
                                  </div>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => setPaymentModeChoice('in_person')}
                                className={[
                                  'w-full rounded-2xl border p-3 text-left transition-all duration-200',
                                  paymentModeChoice === 'in_person'
                                    ? 'border-[#1FA7A6] bg-white ring-2 ring-[#1FA7A6]/10'
                                    : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-white',
                                ].join(' ')}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={[
                                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                                      paymentModeChoice === 'in_person'
                                        ? 'border-[#FFC145] bg-[#FFC145]'
                                        : 'border-slate-300 bg-white',
                                    ].join(' ')}
                                  >
                                    {paymentModeChoice === 'in_person' && (
                                      <div className="h-2 w-2 rounded-full bg-[#0F1D2D]" />
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="text-sm font-black text-[#0F1D2D]">
                                      Paga in salone
                                    </div>

                                    <div className="mt-1 text-xs leading-5 text-slate-500">
                                      Invierai la richiesta e pagherai direttamente in sede.
                                    </div>
                                  </div>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}

                        {isDesktop && (
                          <button
                            type="button"
                            onClick={() => setReviewOpen(true)}
                            disabled={!canSubmit}
                            className="mt-1 w-full rounded-2xl bg-[#FFC145] px-4 py-3 font-black text-[#0F1D2D] shadow-sm transition hover:-translate-y-[1px] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Riepilogo
                          </button>
                        )}
                      </section>
                    )}
                  </>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* REVIEW MODAL */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1D2D]/60 p-4 backdrop-blur-sm">
          <div className="grid w-full max-w-md gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
                  Ultimo controllo
                </p>
                <h3 className="text-xl font-black text-[#0F1D2D]">
                  Controlla il riepilogo
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Verifica i dati prima di confermare.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold transition hover:bg-slate-50"
              >
                Chiudi
              </button>
            </div>

            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-[#F8FAFC] p-4 text-sm">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Servizio
                </div>
                <div className="font-black text-[#0F1D2D]">
                  {selectedService?.name || '—'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Prezzo
                  </div>
                  <div className="font-bold text-[#0F1D2D]">
                    {selectedService
                      ? `€ ${(selectedService.price_cents / 100).toFixed(2)}`
                      : '—'}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Durata
                  </div>
                  <div className="font-bold text-[#0F1D2D]">
                    {selectedService ? `${selectedService.duration_minutes} min` : '—'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Giorno
                  </div>
                  <div className="font-bold text-[#0F1D2D]">{date || '—'}</div>
                </div>

                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Orario
                  </div>
                  <div className="font-bold text-[#0F1D2D]">{selectedTime || '—'}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Operatore
                </div>
                <div className="font-bold text-[#0F1D2D]">
                  {selectedStaffId === 'any'
                    ? 'Assegnazione automatica'
                    : staff.find(s => s.id === selectedStaffId)?.name || '—'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Nome
                  </div>
                  <div className="font-bold text-[#0F1D2D]">{name || '—'}</div>
                </div>

                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Email
                  </div>
                  <div className="break-all font-bold text-[#0F1D2D]">{email || '—'}</div>
                </div>
              </div>

              {phone ? (
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Telefono
                  </div>
                  <div className="font-bold text-[#0F1D2D]">{phone}</div>
                </div>
              ) : null}

              {note ? (
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Note
                  </div>
                  <div className="font-bold text-[#0F1D2D]">{note}</div>
                </div>
              ) : null}

              <div>
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Pagamento
                </div>
                <div className="font-bold text-[#0F1D2D]">
                  {effectivePaymentMode === 'online' ? 'Online' : 'In salone'}
                </div>
              </div>
            </div>
<div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
  Riceverai una conferma via email con tutti i dettagli della prenotazione.
  {effectivePaymentMode === 'online'
    ? ' Dopo il pagamento online, la prenotazione sarà confermata.'
    : ' Il pagamento avverrà direttamente in salone.'}
</div>
            <button
              type="button"
              onClick={submitBooking}
              className="w-full rounded-2xl bg-[#FFC145] px-4 py-3 font-black text-[#0F1D2D] shadow-sm transition hover:brightness-95"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP FIXED FOOTER CONTATTI */}
<DesktopContactFooter tenant={tenant} mapsUrl={mapsUrl} />
{/* MOBILE INFO SHEET */}
<MobileContactSheet
  open={contactSheetOpen}
  tenant={tenant}
  mapsUrl={mapsUrl}
  onClose={() => setContactSheetOpen(false)}
/>
      {/* MOBILE STEP BAR */}
      <MobileStepBar
  currentStep={currentStep}
  mainColor={mainColor}
  canGoStep2={canGoStep2}
  canGoStep3={canGoStep3}
  canSubmit={canSubmit}
  onBack={() => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2 | 3)
    }
  }}
  onContinue={() => {
    if (currentStep === 1 && canGoStep2) {
      setCurrentStep(2)
      return
    }

    if (currentStep === 2 && canGoStep3) {
      setCurrentStep(3)
      return
    }

    if (currentStep === 3 && canSubmit) {
      setReviewOpen(true)
    }
  }}
/>
    </main>
  )
}
