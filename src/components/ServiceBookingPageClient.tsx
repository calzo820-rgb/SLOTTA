'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  buildSegments,
  buildSlots,
  getSlotReasonLabel,
  type Slot,
  timeStrToMinutes,
} from '@/lib/bookingSlots'
type TenantInfo = {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  primary_color?: string | null
  address?: string | null
  banner_url?: string | null
}

type Service = {
  id: string
  name: string
  description?: string | null
  duration_minutes: number
  price_cents: number
  image_url?: string | null
}

type StaffMember = {
  id: string
  name: string
  is_active: boolean
  position: number
}

type Props = {
  tenant: TenantInfo
  services: Service[]
}
type StaffHoursRow = {
  staff_id: string
  dow: number
  open_time_am?: string | null
  close_time_am?: string | null
  pm_enabled?: boolean | null
  open_time_pm?: string | null
  close_time_pm?: string | null
  is_closed?: boolean | null
}
type StaffSelectionMode = 'client_choice' | 'auto_only'
type PaymentModeDefault = 'online' | 'in_person' | 'client_choice'
type PaymentModeEffective = 'online' | 'in_person'

// ----------------------
// Helpers
// ----------------------




function safeIsoTodayLocal() {
  // evita problemi di timezone con toISOString
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ----------------------
// Component
// ----------------------
export default function ServiceBookingPageClient({ tenant, services }: Props) {
  console.log('TENANT CLIENTE:', tenant)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    services[0]?.id ?? null,
  )
const [staff, setStaff] = useState<StaffMember[]>([])
const [selectedStaffId, setSelectedStaffId] = useState<'any' | string>('any')
const [showStaffPicker, setShowStaffPicker] = useState(false)
  const today = useMemo(() => safeIsoTodayLocal(), [])
  const [date, setDate] = useState<string>(today)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [errorSlots, setErrorSlots] = useState<string | null>(null)
  const [isClosedDay, setIsClosedDay] = useState(false)
const [showOptionalFields, setShowOptionalFields] = useState(false)
const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [email, setEmail] = useState('')
const [reviewOpen, setReviewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
const [morningEndTime, setMorningEndTime] = useState<string | null>(null)
 const [isDesktop, setIsDesktop] = useState(false)
// ⚙️ pagamento
  const [paymentModeDefault, setPaymentModeDefault] =
    useState<PaymentModeDefault>('online')
  const [paymentModeChoice, setPaymentModeChoice] =
    useState<PaymentModeEffective>('online')
const [staffSelectionMode, setStaffSelectionMode] =
  useState<'client_choice' | 'auto_only'>('client_choice')
  const mainColor = tenant.primary_color || '#b91c1c'
const mapsUrl = tenant.address
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`
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
  // ==============================
  // CARICAMENTO SLOT + SETTINGS
  // ==============================
  useEffect(() => {
    let cancelled = false

    async function loadSlots() {
      if (!tenant.id || !date) {
        setSlots([])
        return
      }

      setLoadingSlots(true)
      setErrorSlots(null)

      try {
        
        // 1) tenant_settings
        const { data: setRows, error: setErr } = await supabase
          .from('tenant_settings')
          .select('slot_minutes, service_staff_count, payment_mode_default, staff_selection_mode')
          .eq('tenant_id', tenant.id)
          .limit(1)
const { data: staffRows, error: staffErr } = await supabase
  .from('staff_members')
  .select('id, name, is_active, position')
  .eq('tenant_id', tenant.id)
  .eq('is_active', true)
  .order('position', { ascending: true })
  .order('name', { ascending: true })

if (staffErr) throw staffErr
setStaff((staffRows || []) as StaffMember[])

        if (setErr) throw setErr

        const row = setRows?.[0] as
          | {
              slot_minutes?: number | null
              service_staff_count?: number | null
              payment_mode_default?: PaymentModeDefault | null
              staff_selection_mode?: StaffSelectionMode | null
            }
          | undefined

        const slotMinutes =
          row?.slot_minutes && row.slot_minutes > 0 ? row.slot_minutes : 30
const leadMinutes = 30
        const staffCount =
          row?.service_staff_count && row.service_staff_count > 0
            ? row.service_staff_count
            : 1

        const pmode: PaymentModeDefault = row?.payment_mode_default || 'online'
        setPaymentModeDefault(pmode)
        setPaymentModeChoice(pmode === 'in_person' ? 'in_person' : 'online')
const smode: StaffSelectionMode = row?.staff_selection_mode || 'client_choice'
setStaffSelectionMode(smode)

if (smode === 'auto_only') {
  setSelectedStaffId('any')
  setShowStaffPicker(false)
}
        // 2) Orari del giorno (tenant_hours) — schema nuovo + fallback vecchio
        const d = new Date(`${date}T00:00:00`)
        const dow = d.getDay() // 0=dom ... 6=sab
        let selectedStaffHours: StaffHoursRow | null = null

        const { data: hourRows, error: hourErr } = await supabase
          .from('tenant_hours')
          .select(
            `
            dow,
            is_closed,
            open_time_am,
            close_time_am,
            pm_enabled,
            has_split,
            open_time_pm,
            close_time_pm,
            open_time,
            close_time
          `,
          )
          .eq('tenant_id', tenant.id)
          .eq('dow', dow)
          .limit(1)

        if (hourErr) throw hourErr

        const r = hourRows?.[0] as any

        // se non c'è riga o è chiuso
if (!r || r.is_closed) {
  if (!cancelled) {
    setIsClosedDay(true)
    setSlots([])
    setLoadingSlots(false)
    setMorningEndTime(null)
  }
  return
}
const { data: staffHoursRows, error: staffHoursErr } = await supabase
  .from('staff_hours')
  .select(
    'staff_id, dow, open_time_am, close_time_am, pm_enabled, open_time_pm, close_time_pm, is_closed',
  )
  .eq('tenant_id', tenant.id)

if (staffHoursErr) throw staffHoursErr
if (selectedStaffId !== 'any') {
  selectedStaffHours =
    ((staffHoursRows || []) as StaffHoursRow[]).find(
      r => r.staff_id === selectedStaffId && r.dow === dow,
    ) || null
}
// giorno aperto
if (!cancelled) setIsClosedDay(false)


        // normalizzazione robusta
        const amOpenStr = (r.open_time_am || r.open_time || '09:00:00') as string
        const amCloseStr = (r.close_time_am || r.close_time || '19:00:00') as string
const normalizedMorningEnd = String(amCloseStr).slice(0, 5)
if (!cancelled) setMorningEndTime(normalizedMorningEnd)
        // se pm_enabled è null/false ma has_split=true => consideriamo PM attivo
        const pmEnabled = Boolean((r.pm_enabled ?? r.has_split) ?? false)
        const pmOpenStr = (r.open_time_pm || '15:00:00') as string
        const pmCloseStr = (r.close_time_pm || '19:00:00') as string

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


        // 3) Prenotazioni esistenti per quella data
        const { data: bookings, error: bookErr } = await supabase
          .from('service_bookings')
          .select('service_id, booking_time, status')
          .eq('tenant_id', tenant.id)
          .eq('booking_date', date)
          .neq('status', 'cancelled')

        if (bookErr) throw bookErr

        const intervals: { start: number; end: number }[] = []
        ;(bookings || []).forEach(b => {
          const start = timeStrToMinutes((b as any).booking_time)
          const dur = durationByServiceId[(b as any).service_id] || 60
          const end = start + dur
          intervals.push({ start, end })
        })

        // durata del servizio selezionato
        const selectedDuration =
          selectedServiceId && durationByServiceId[selectedServiceId]
            ? durationByServiceId[selectedServiceId]
            : 60

        // 4) genera slot su ogni segmento (mattina + pomeriggio)
const slotsTmp = buildSlots({
  date,
  segments,
  slotMinutes,
  selectedDuration,
  intervals,
  staffCount,
  leadMinutes,
})

        if (!cancelled) {
          setSlots(slotsTmp)
        }
      } catch (e: any) {
  if (!cancelled) {
    console.error('Errore caricamento slot servizi', {
  message: e?.message,
  error: e,
  tenantId: tenant.id,
  date,
  selectedServiceId,
  selectedStaffId,
})

    const msg = String(e?.message || '')
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
        }
      }
    }

    loadSlots()
    return () => {
      cancelled = true
    }
  }, [tenant.id, date, durationByServiceId, selectedServiceId, selectedStaffId])

  useEffect(() => {
  const params = new URLSearchParams(window.location.search)

  const status = params.get('status')
  const service = params.get('service')
  const dateParam = params.get('date')
  const timeParam = params.get('time')
  const staffParam = params.get('staff')

  if (status === 'cancel') {
    if (service) setSelectedServiceId(service)
    if (dateParam) setDate(dateParam)
    if (timeParam) setSelectedTime(timeParam)
    if (staffParam) setSelectedStaffId(staffParam as any)
  }
}, [])

  // modalità di pagamento effettiva
  const effectivePaymentMode: PaymentModeEffective =
    paymentModeDefault === 'client_choice' ? paymentModeChoice : paymentModeDefault

  // ==============================
  // SUBMIT + CHECKOUT STRIPE
  // ==============================
  async function submitBooking() {
    if (!tenant.id || !selectedService || !date || !selectedTime) {
      alert('Seleziona un servizio, un giorno e un orario, e inserisci il nome.')
      return
    }
    if (!isNameOk) {
  alert('Controlla il nome inserito.')
  return
}
if (!isEmailOk) {
  alert('Controlla l’email inserita.')
  return
}

    const slot = slots.find(s => s.time === selectedTime)
    if (!slot || slot.disabled) {
      alert('L’orario selezionato non è disponibile.')
      return
    }

    setSubmitting(true)
    setSuccessMessage(null)

    try {
// 1) Creo prenotazione via API (assegna anche staff se ANY)
const resBook = await fetch('/api/service-book', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_id: tenant.id,
    service_id: selectedService.id,
    booking_date: date,
    booking_time: selectedTime,
    customer_name: name,
    customer_email: email,
    customer_phone: phone || null,
    note: note || null,
    staff_id: selectedStaffId === 'any' ? null : selectedStaffId,
  }),
})

const bookData = await resBook.json().catch(() => ({} as any))

if (!resBook.ok || !bookData?.booking_id) {
  const msg = bookData?.error || 'Errore nella creazione della prenotazione.'

  // ✅ errori "previsti" (validazione/business rule) -> NO throw, solo UI
  // (aggiungi qui eventuali altri messaggi che vuoi trattare come "soft")
  if (
    msg.includes('Operatore già occupato') ||
    msg.includes('Nessun operatore attivo') ||
    msg.includes('Seleziona un operatore')
  ) {
    // usa il tuo sistema di popup/alert/toast
    alert(msg) // oppure setError(msg) / setToast(msg)
    return
  }

  // ❌ errori "inaspettati" -> throw (così li vedi in console)
  throw new Error(msg)
}


const bookingId = bookData.booking_id as string


      // 2A) Email "ricevuta prenotazione"
      if (email) {
        try {
          const html = `
            <p>Ciao ${name || ''},</p>
            <p>abbiamo ricevuto la tua richiesta di prenotazione per il servizio
            <strong>"${selectedService.name}"</strong> il <strong>${date}</strong> alle <strong>${selectedTime}</strong>.</p>
            <p>Ti confermeremo al più presto la disponibilità del salone.</p>
            <p>A presto,<br/><strong>${tenant.name}</strong></p>
          `

          await fetch('/api/send-confirmation-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: email,
              subject: `Richiesta prenotazione - ${tenant.name}`,
              html,
            }),
          })
        } catch (e) {
          console.error('Errore invio email di conferma ricezione', e)
        }
      }

      // 2) Se pagamento in salone -> niente Stripe
      if (effectivePaymentMode === 'in_person') {
        setSuccessMessage(
  `Abbiamo ricevuto la tua richiesta per ${selectedService.name} il ${date} alle ${selectedTime}. Pagherai direttamente in salone.`,
)
        setSubmitting(false)
        return
      }

      // 3) Pagamento online: sessione Stripe e redirect
      const base = window.location.origin
const successUrl = `${base}/t/${tenant.slug}/success?booking=${bookingId}&status=success`
const cancelUrl = `${base}/t/${tenant.slug}?status=cancel&service=${selectedService.id}&date=${date}&time=${selectedTime}&staff=${selectedStaffId}`

      const res = await fetch('/api/service-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Errore nel pagamento')
      }

      window.location.href = data.url
    } catch (e: any) {
      console.error(e)
      alert(e?.message || 'Errore durante la prenotazione / pagamento.')
      setSubmitting(false)
    }
  }

  // label bottone
  const isServiceSelected = !!selectedService
  const isSlotSelected = !!selectedTime
  const isNameOk = name.trim().length >= 2
  const isEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
const nameError =
  name.length === 0 ? '' : name.trim().length < 2 ? 'Inserisci almeno 2 caratteri.' : ''

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
const canOpenReview = isNameOk && isEmailOk
const steps = [
  { id: 1, label: 'Servizio' },
  { id: 2, label: 'Orario' },
  { id: 3, label: 'Dati' },
] as const
  const canSubmit =
    isServiceSelected && isSlotSelected && isSlotValid && isNameOk && isEmailOk && !submitting

  const buttonLabel = (() => {
    if (submitting) {
      return effectivePaymentMode === 'online' ? 'Reindirizzamento…' : 'Invio prenotazione…'
    }
    if (!isServiceSelected) return 'Scegli un servizio'
    if (!isSlotSelected) return 'Seleziona un orario'
    if (!isNameOk || !isEmailOk) return 'Inserisci nome ed email'
    return effectivePaymentMode === 'online' ? 'Prenota e paga ora' : 'Conferma appuntamento'
  })()

  // ==============================
  // RENDER
  // ==============================
 const morningSlots = useMemo(() => {
  if (!morningEndTime) return slots
  return slots.filter(s => s.time < morningEndTime)
}, [slots, morningEndTime])

const afternoonSlots = useMemo(() => {
  if (!morningEndTime) return []
  return slots.filter(s => s.time >= morningEndTime)
}, [slots, morningEndTime])

  return (
    <main className="min-h-screen bg-zinc-50 px-4 pt-4 md:px-6 md:pt-6 pb-36 md:pb-6">
      {/* Header */}
      <header className="md:sticky md:top-0 md:z-40 md:bg-zinc-50/95 md:backdrop-blur md:border-b">
  <div className="max-w-[1500px] mx-auto px-4 md:px-6 py-3">
    <div className="flex items-center gap-3">
      {tenant.logo_url && (
        <img
          src={tenant.logo_url}
          alt={tenant.name}
          className="h-10 w-10 md:h-12 md:w-12 object-contain rounded bg-white border"
        />
      )}

      <div>
        <h1 className="text-xl md:text-3xl font-bold" style={{ color: mainColor }}>
          {tenant.name}
        </h1>
        
        {tenant.address && mapsUrl && (
  <a
    href={mapsUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-600 hover:underline"
  >
    📍 {tenant.address}
    <span className="text-[10px] text-zinc-400">(Apri Maps)</span>
  </a>
)}
      </div>
    </div>
  </div>
</header>
{typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('status') === 'cancel' && (
    <div className="max-w-[1500px] mx-auto mb-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Il pagamento non è stato completato. Puoi riprovare mantenendo i dati selezionati.
      </div>
    </div>
  )}
      {/* Layout */}
      <div className="max-w-[1500px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* LEFT */}
        {(currentStep === 1 || isDesktop) && (
  <section className="md:col-span-2 grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base md:text-lg font-semibold leading-tight">1) Scegli il servizio</h2>
            <span className="text-xs text-zinc-500">Poi scegli giorno e orario</span>
          </div>

          {services.length === 0 && (
            <div className="text-sm text-zinc-600">Nessun servizio disponibile al momento.</div>
          )}

          {services.map(svc => {
            const selected = svc.id === selectedServiceId
            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => {
                  setSelectedServiceId(svc.id)
                  setSelectedTime('')
                }}
               className={`border rounded-xl p-2 md:p-3 flex gap-2 md:gap-3 bg-white text-left transition
                  hover:shadow-sm hover:border-zinc-300
                  ${selected ? 'border-2 shadow-sm' : 'border-zinc-200'}
                `}
                style={{ borderColor: selected ? mainColor : undefined }}
              >
                {svc.image_url ? (
                  <img
                    src={svc.image_url}
                    alt={svc.name}
                    className="w-16 h-16 md:w-24 md:h-24 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-16 h-16 md:w-24 md:h-24 rounded bg-zinc-100 flex items-center justify-center text-[10px] text-zinc-500">
                    Nessuna immagine
                  </div>
                )}

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    {selected && (
                      <div
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full mb-2"
                        style={{ backgroundColor: `${mainColor}12`, color: mainColor }}
                      >
                        ✓ Selezionato
                      </div>
                    )}

                    <div className="font-semibold text-sm md:text-base">{svc.name}</div>

                    {svc.description && (
                      <div className="text-xs md:text-sm text-zinc-600 mt-1">{svc.description}</div>
                    )}
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs md:text-sm">
                    <div className="text-zinc-700">
                      Durata: <span className="font-medium">{svc.duration_minutes} min</span>
                    </div>
                    <div className="font-semibold">€ {(svc.price_cents / 100).toFixed(2)}</div>
                  </div>
                </div>
              </button>
            )
            
          })}
          <div className="pt-2">
 
</div>
          </section>
)}

        {/* RIGHT */}
        {(currentStep > 1 || isDesktop) && (
  <aside className="md:col-span-1 md:sticky md:top-6">
          <div className="border rounded-xl p-4 bg-white grid gap-3 shadow-sm">
            <div>
              <h2 className="font-semibold text-lg">Prenota il tuo appuntamento</h2>
<p className="text-xs text-zinc-500 -mt-1">
  Completa i passaggi per confermare la prenotazione
</p>
            </div>
<div className="hidden">
  <div className="flex items-center gap-2">
    {steps.map((step, index) => {
      const isActive = currentStep === step.id
      const isDone = currentStep > step.id

      return (
        <div key={step.id} className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border shrink-0 ${
                isDone
                  ? 'text-white border-transparent'
                  : isActive
                  ? 'bg-white border-current'
                  : 'bg-white text-zinc-400 border-zinc-300'
              }`}
              style={{
                backgroundColor: isDone ? mainColor : undefined,
                color: isDone || isActive ? mainColor : undefined,
              }}
            >
              {isDone ? '✓' : step.id}
            </div>

            <span
              className={`text-xs font-medium truncate ${
                isActive ? 'text-zinc-900' : isDone ? 'text-zinc-700' : 'text-zinc-400'
              }`}
            >
              {step.label}
            </span>
          </div>

          {index < steps.length - 1 && (
            <div className="flex-1 h-px bg-zinc-200 min-w-[12px]" />
          )}
        </div>
      )
    })}
  </div>
</div>
            {!selectedService && (
              <div className="text-sm text-zinc-600">Seleziona un servizio dalla lista a sinistra.</div>
            )}

            {selectedService && (
              <>
                   
{(currentStep === 2 || isDesktop) && (
  <>
                <div className="h-px bg-zinc-100 my-1" />
                <h3 className="text-sm font-semibold">2) Giorno e orario</h3>

                {/* Date */}
                <div className="grid gap-2 text-sm">
  <label className="font-medium">Giorno</label>

  <div className="rounded-xl border bg-white px-3 py-3">
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
      className="w-full bg-transparent outline-none text-base md:text-sm"
    />
  </div>

  <div className="text-xs text-zinc-500">
    Seleziona il giorno in cui vuoi venire.
  </div>
</div>
<div className="grid gap-2 text-sm">

  {staff.length > 1 && staffSelectionMode === 'client_choice' && (
  <div className="grid gap-2 text-sm">
    <div className="font-medium">Preferenze operatore</div>

    {!showStaffPicker ? (
      <div className="rounded-xl border bg-zinc-50 p-3 grid gap-2">
        <div className="text-sm font-medium text-zinc-800">
          Assegnazione automatica
        </div>

        <div className="text-xs text-zinc-600">
          Ti assegniamo automaticamente l’operatore disponibile più adatto all’orario scelto.
        </div>

        <button
          type="button"
          onClick={() => setShowStaffPicker(true)}
          className="text-sm underline underline-offset-2 text-left"
          style={{ color: mainColor }}
        >
          Preferisco scegliere io
        </button>
      </div>
    ) : (
      <div className="grid gap-2">
        <div className="rounded-xl border bg-white p-3 grid gap-2">
          <div className="text-sm font-medium text-zinc-800">
            Scegli il tuo operatore
          </div>

          <select
            value={selectedStaffId}
            onChange={e => {
              setSelectedStaffId(e.target.value as any)
              setSelectedTime('')
              setErrorSlots(null)
            }}
            className="border rounded-xl px-3 py-3 text-base md:text-sm bg-white"
          >
            <option value="any">Assegnazione automatica</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="text-xs text-zinc-500">
            Se scegli un operatore specifico, vedrai solo gli orari disponibili per lui o lei.
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowStaffPicker(false)
            setSelectedStaffId('any')
            setSelectedTime('')
            setErrorSlots(null)
          }}
          className="text-xs underline underline-offset-2 text-left text-zinc-500"
        >
          Torna ad assegnazione automatica
        </button>
      </div>
    )}
  </div>
)}
</div>

                {/* Slots */}
                <div className={`grid gap-1 text-sm ${loadingSlots ? 'opacity-60' : 'opacity-100'} transition-opacity`}>
  <div className="font-medium">Orario</div>

  <div className="text-xs text-zinc-500">
    Gli orari in grigio non sono prenotabili.
  </div>

                 
                  {errorSlots && <div className="text-xs text-red-600">{errorSlots}</div>}
                  {!loadingSlots && slots.length === 0 && !errorSlots && (
  <div
    className={[
      'text-xs rounded-xl border p-3',
      isClosedDay ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-900',
    ].join(' ')}
  >
    <div className="font-semibold">
      {isClosedDay ? 'Giorno di chiusura' : 'Nessun orario disponibile'}
    </div>
    <div className="mt-1">
      {isClosedDay
        ? 'Il salone è chiuso in questa data. Seleziona un altro giorno.'
        : 'Prova a scegliere un altro giorno.'}
    </div>
  </div>
)}

                  {/* MATTINA */}
{morningSlots.length > 0 && (
  <div className="mb-2">
    <div className="text-xs font-semibold text-zinc-500 mb-1">
      Mattina
    </div>

    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {morningSlots.map(s => {
        const isSelected = s.time === selectedTime
        return (
          <button
  key={s.time}
  type="button"
  onClick={() => !s.disabled && setSelectedTime(s.time)}
  disabled={s.disabled}
  title={s.disabled ? getSlotReasonLabel(s.reason) : ''}
  className={`px-3 py-2 rounded-xl border text-sm font-medium transition flex items-center justify-center min-h-[44px]
    ${s.disabled ? 'text-zinc-400 border-zinc-200 bg-zinc-50' : 'border-zinc-200'}
    ${isSelected && !s.disabled ? 'text-white' : 'bg-white'}
  `}
  style={{
    background: isSelected && !s.disabled ? mainColor : undefined,
    borderColor: s.disabled ? '#d1d5db' : mainColor,
    opacity: s.disabled ? 0.6 : 1,
  }}
>
  <span>{s.time}</span>
</button>
        )
      })}
    </div>
  </div>
)}

{/* POMERIGGIO */}
{afternoonSlots.length > 0 && (
  <div>
    <div className="text-xs font-semibold text-zinc-500 mb-1">
      Pomeriggio
    </div>

    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {afternoonSlots.map(s => {
        const isSelected = s.time === selectedTime
        return (
          <button
  key={s.time}
  type="button"
  onClick={() => !s.disabled && setSelectedTime(s.time)}
  disabled={s.disabled}
  title={s.disabled ? getSlotReasonLabel(s.reason) : ''}
  className={`px-3 py-2 rounded-xl border text-sm font-medium transition flex items-center justify-center min-h-[44px]
    ${s.disabled ? 'text-zinc-400 border-zinc-200 bg-zinc-50' : 'border-zinc-200'}
    ${isSelected && !s.disabled ? 'text-white' : 'bg-white'}
  `}
  style={{
    background: isSelected && !s.disabled ? mainColor : undefined,
    borderColor: s.disabled ? '#d1d5db' : mainColor,
    opacity: s.disabled ? 0.6 : 1,
  }}
>
  <span>{s.time}</span>
</button>
        )
      })}
    </div>
  </div>
)}

                </div>
                  </>
)}
{(currentStep === 3 || isDesktop) && (
  <>
                <div className="h-px bg-zinc-100 mt-2" />
                <h3 className="text-sm font-semibold">3) I tuoi dati</h3>

                <div className="grid gap-2 text-sm mt-1">
                  <div className="grid gap-1">
  <input
    value={name}
    onChange={e => setName(e.target.value)}
    placeholder="Nome e cognome"
    className="border rounded-xl px-3 py-3 text-base md:text-sm"
    style={{ borderColor: nameError ? '#dc2626' : undefined }}
  />
  {nameError ? <div className="text-xs text-red-600">{nameError}</div> : null}
</div>

                  <div className="grid gap-1">
  <input
    value={email}
    onChange={e => setEmail(e.target.value)}
    placeholder="Email"
    type="email"
    className="border rounded-xl px-3 py-3 text-base md:text-sm"
    style={{ borderColor: emailError ? '#dc2626' : undefined }}
  />
  {emailError ? (
    <div className="text-xs text-red-600">{emailError}</div>
  ) : (
    <div className="text-xs text-zinc-500">Riceverai qui la conferma dell’appuntamento.</div>
  )}
</div>

                  {!showOptionalFields ? (
  <button
    type="button"
    onClick={() => setShowOptionalFields(true)}
    className="text-sm underline underline-offset-2 text-left"
    style={{ color: mainColor }}
  >
    Aggiungi telefono o note
  </button>
) : (
  <div className="grid gap-2">
    <input
      value={phone}
      onChange={e => setPhone(e.target.value)}
      placeholder="Telefono (opzionale)"
      className="border rounded-xl px-3 py-3 text-base md:text-sm"
    />
    <div className="text-xs text-zinc-500 -mt-1">
      Usato solo in caso di necessità (es. variazioni di orario).
    </div>

    <textarea
      value={note}
      onChange={e => setNote(e.target.value)}
      placeholder="Note (opzionali)"
      className="border rounded-xl px-3 py-3 text-base md:text-sm"
      rows={2}
    />

    <button
      type="button"
      onClick={() => {
        setShowOptionalFields(false)
        setPhone('')
        setNote('')
      }}
      className="text-xs underline underline-offset-2 text-left text-zinc-500"
    >
      Nascondi dettagli facoltativi
    </button>
  </div>
)}
</div>


                {paymentModeDefault === 'client_choice' && (
                  <div className="grid gap-1 text-sm mt-2">
                    <div className="font-medium">Pagamento</div>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment-mode"
                        value="online"
                        checked={paymentModeChoice === 'online'}
                        onChange={() => setPaymentModeChoice('online')}
                      />
                      <span>Paga online ora</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment-mode"
                        value="in_person"
                        checked={paymentModeChoice === 'in_person'}
                        onChange={() => setPaymentModeChoice('in_person')}
                      />
                      <span>Paga in salone</span>
                    </label>
                  </div>
                )}
{isDesktop && (
  <button
    type="button"
    onClick={() => setReviewOpen(true)}
    disabled={!canSubmit}
    className="mt-3 w-full px-4 py-3 rounded-xl text-white font-medium disabled:cursor-not-allowed"
    style={{ background: mainColor, opacity: !canSubmit ? 0.6 : 1 }}
  >
    Riepilogo
  </button>
)}
                {successMessage && (
  <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 grid gap-1">
    <div className="font-semibold">Prenotazione inviata con successo</div>
    <div>{successMessage}</div>
    <div className="text-xs text-green-700">
      Riceverai conferma via email appena il salone prende in carico la richiesta.
    </div>
  </div>
)}
<div className="flex gap-2 mt-3">

</div>
 </>
)}
              </>
            )}
          </div>

          {/* CTA sticky mobile */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t">
            <div className="text-[11px] text-zinc-500 mt-1 text-center">
              Riceverai la conferma via email.
            </div>
          </div>
        </aside>
        )}
      </div>
     {reviewOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border p-5 grid gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Controlla il riepilogo</h3>
              <p className="text-sm text-zinc-500">
                Verifica i dati prima di confermare.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setReviewOpen(false)}
              className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50"
            >
              Chiudi
            </button>
          </div>

   <div className="rounded-xl border bg-zinc-50 p-4 grid gap-3 text-sm">
  <div>
    <div className="text-xs uppercase tracking-wide text-zinc-500">Servizio</div>
    <div className="font-semibold">{selectedService?.name || '—'}</div>
  </div>

  <div className="grid grid-cols-2 gap-3">
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">Prezzo</div>
      <div className="font-medium">
        {selectedService ? `€ ${(selectedService.price_cents / 100).toFixed(2)}` : '—'}
      </div>
    </div>

    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">Durata</div>
      <div className="font-medium">
        {selectedService ? `${selectedService.duration_minutes} min` : '—'}
      </div>
    </div>
  </div>

  <div className="grid grid-cols-2 gap-3">
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">Giorno</div>
      <div className="font-medium">{date || '—'}</div>
    </div>

    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">Orario</div>
      <div className="font-medium">{selectedTime || '—'}</div>
    </div>
  </div>

  <div>
    <div className="text-xs uppercase tracking-wide text-zinc-500">Operatore</div>
    <div className="font-medium">
      {selectedStaffId === 'any'
        ? 'Assegnazione automatica'
        : staff.find(s => s.id === selectedStaffId)?.name || '—'}
    </div>
  </div>

  <div className="grid grid-cols-2 gap-3">
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">Nome</div>
      <div className="font-medium">{name || '—'}</div>
    </div>

    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">Email</div>
      <div className="font-medium break-all">{email || '—'}</div>
    </div>
  </div>

  {phone ? (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">Telefono</div>
      <div className="font-medium">{phone}</div>
    </div>
  ) : null}

  {note ? (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">Note</div>
      <div className="font-medium">{note}</div>
    </div>
  ) : null}

  <div>
    <div className="text-xs uppercase tracking-wide text-zinc-500">Pagamento</div>
    <div className="font-medium">
      {effectivePaymentMode === 'online' ? 'Online' : 'In salone'}
    </div>
  </div>
</div>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={submitBooking}
              className="w-full px-4 py-3 rounded-xl text-white font-medium"
              style={{ background: mainColor }}
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
    )}
<div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t p-3 grid gap-3">
  <div className="grid grid-cols-3 gap-2">
    {[1, 2, 3].map(step => (
      <div
        key={step}
        className="h-2 rounded-full"
        style={{
          background:
            currentStep >= step ? mainColor : '#e4e4e7',
        }}
      />
    ))}
  </div>

  <div className="flex gap-2">
    <button
      type="button"
      onClick={() => {
        if (currentStep > 1) setCurrentStep((currentStep - 1) as 1 | 2 | 3)
      }}
      disabled={currentStep === 1}
      className="flex-1 px-4 py-3 rounded-xl border text-sm font-medium disabled:opacity-50"
    >
      Indietro
    </button>

    <button
      type="button"
      onClick={() => {
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
      disabled={
        (currentStep === 1 && !canGoStep2) ||
        (currentStep === 2 && !canGoStep3) ||
        (currentStep === 3 && !canSubmit)
      }
      className="flex-1 px-4 py-3 rounded-xl text-white font-medium disabled:opacity-50"
      style={{ background: mainColor }}
    >
      {currentStep === 3 ? 'Continua' : 'Continua'}
    </button>
  </div>
</div>
  </main>
)
}
