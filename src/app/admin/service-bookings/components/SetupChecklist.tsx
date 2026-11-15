'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getNowInTimeZone } from '@/lib/bookingRequest'
import type { AvailabilityClosure } from '@/lib/bookingSlots'
import {
  hasBookableSlotOnDate,
  type SetupAvailabilitySettings,
  type SetupBusySlot,
  type SetupHours,
  type SetupStaff,
  type SetupStaffHours,
} from '@/lib/setupChecklist'

type StepId = 'profile' | 'hours' | 'staff' | 'services'
type Step = { id: StepId; complete: boolean }
type Service = { id: string; duration_minutes: number | null }
type PublicBookingConfig = {
  error?: string
  settings?: SetupAvailabilitySettings | null
  staff?: SetupStaff[]
  tenant_hours?: SetupHours | null
  staff_hours?: SetupStaffHours[]
  closures?: AvailabilityClosure[]
}
type PublicBusySlots = { error?: string; bookings?: SetupBusySlot[] }
type ProgressPayload = {
  error?: string
  steps?: Step[]
  services?: Service[]
  timezone?: string
}

const STEP_DETAILS: Array<{
  id: StepId
  title: string
  description: string
  href: string
  action: string
}> = [
  {
    id: 'profile',
    title: 'Dati attività',
    description: 'Nome, indirizzo e almeno un recapito.',
    href: '/admin/profile',
    action: 'Apri Profilo',
  },
  {
    id: 'hours',
    title: 'Orari di apertura',
    description: 'Imposta almeno una fascia in cui ricevere prenotazioni.',
    href: '/admin/hours',
    action: 'Apri Orari',
  },
  {
    id: 'staff',
    title: 'Operatori',
    description: 'Aggiungi un operatore e verifica i suoi orari.',
    href: '/admin/staff',
    action: 'Apri Operatori',
  },
  {
    id: 'services',
    title: 'Servizi',
    description: 'Crea almeno un servizio attivo con nome, durata e prezzo validi.',
    href: '/admin/services',
    action: 'Apri Servizi',
  },
]

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}

function setupMarker(tenantId: string) {
  return `slotta-setup-in-progress:${tenantId}`
}

export default function SetupChecklist({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const [steps, setSteps] = useState<Step[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [timezone, setTimezone] = useState('Europe/Rome')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  const [availability, setAvailability] = useState<
    'idle' | 'checking' | 'available' | 'none' | 'error'
  >('idle')
  const [checkedDays, setCheckedDays] = useState(0)
  const forceOpenRef = useRef(false)
  const guideOpenRef = useRef(false)
  const availabilityAttemptedRef = useRef(false)
  const scanControllerRef = useRef<AbortController | null>(null)
  const progressRequestRef = useRef(false)
  const allComplete = steps.length === STEP_DETAILS.length && steps.every(step => step.complete)
  const completedCount = steps.filter(step => step.complete).length

  const setGuideOpen = useCallback((nextOpen: boolean) => {
    guideOpenRef.current = nextOpen
    setOpen(nextOpen)
  }, [])

  const runAvailabilityCheck = useCallback(
    async (activeServices: Service[], businessTimezone: string) => {
      scanControllerRef.current?.abort()
      const controller = new AbortController()
      scanControllerRef.current = controller
      setAvailability('checking')
      setCheckedDays(0)

      try {
        const now = getNowInTimeZone(businessTimezone)
        const durationByServiceId = Object.fromEntries(
          activeServices.map(service => [
            service.id,
            Number(service.duration_minutes) > 0
              ? Number(service.duration_minutes)
              : 60,
          ]),
        )

        for (let dayIndex = 0; dayIndex < 14; dayIndex += 1) {
          const date = addDays(now.date, dayIndex)
          const [configResponse, busyResponse] = await Promise.all([
            fetch('/api/public/booking-config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tenant_id: tenantId, booking_date: date }),
              signal: controller.signal,
            }),
            fetch('/api/public/booked-slots', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tenant_id: tenantId, booking_date: date, staff_id: null }),
              signal: controller.signal,
            }),
          ])
          const [config, busy] = (await Promise.all([
            configResponse.json(),
            busyResponse.json(),
          ])) as [PublicBookingConfig, PublicBusySlots]

          if (!configResponse.ok || !busyResponse.ok) {
            throw new Error(config.error || busy.error || 'Controllo disponibilità non riuscito.')
          }

          const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay()
          const tenantHours = config.tenant_hours || null
          const dateClosures = config.closures || []
          const staffHours = (config.staff_hours || []).filter(
            row => row.dow === dayOfWeek,
          )
          const activeStaff = config.staff || []

          for (const service of activeServices) {
            if (
              hasBookableSlotOnDate({
                date,
                currentDate: now.date,
                currentMinutes: now.minutes,
                serviceId: service.id,
                durationByServiceId,
                settings: config.settings || null,
                staff: activeStaff,
                tenantHours,
                staffHours,
                closures: dateClosures,
                busySlots: busy.bookings || [],
              })
            ) {
              setAvailability('available')
              setCheckedDays(dayIndex + 1)
              return
            }
          }

          setCheckedDays(dayIndex + 1)
        }

        setAvailability('none')
      } catch (checkError) {
        if (checkError instanceof DOMException && checkError.name === 'AbortError') return
        setAvailability('error')
      }
    },
    [tenantId],
  )

  const loadProgress = useCallback(
    async (initial = false) => {
      if (progressRequestRef.current) return
      progressRequestRef.current = true
      if (initial) setLoading(true)
      else setRefreshing(true)
      setError(null)

      try {
        const response = await fetch('/api/admin/setup-progress', {
          method: 'GET',
          cache: 'no-store',
        })
        const payload = (await response.json()) as ProgressPayload
        if (!response.ok) throw new Error(payload.error || 'Impossibile verificare i passaggi.')

        const nextSteps = payload.steps || []
        const nextServices = payload.services || []
        const nextTimezone = payload.timezone || 'Europe/Rome'
        const nextComplete =
          nextSteps.length === STEP_DETAILS.length && nextSteps.every(step => step.complete)
        const marker = setupMarker(tenantId)
        const wasInProgress = sessionStorage.getItem(marker) === 'in-progress'

        setSteps(nextSteps)
        setServices(nextServices)
        setTimezone(nextTimezone)

        if (!nextComplete) {
          sessionStorage.setItem(marker, 'in-progress')
          setGuideOpen(true)
          setShowCompletion(false)
          availabilityAttemptedRef.current = false
        } else if (forceOpenRef.current || wasInProgress || guideOpenRef.current) {
          setGuideOpen(true)
          setShowCompletion(true)
          sessionStorage.removeItem(marker)
          if (!availabilityAttemptedRef.current) {
            availabilityAttemptedRef.current = true
            void runAvailabilityCheck(nextServices, nextTimezone)
          }
        } else {
          setGuideOpen(false)
          setShowCompletion(false)
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Impossibile verificare i passaggi.',
        )
      } finally {
        progressRequestRef.current = false
        setLoading(false)
        setRefreshing(false)
      }
    },
    [runAvailabilityCheck, setGuideOpen, tenantId],
  )

  useEffect(() => {
    forceOpenRef.current =
      new URLSearchParams(window.location.search).get('setup') === '1'
    void loadProgress(true)

    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') void loadProgress(false)
    }
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnFocus)

    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnFocus)
      scanControllerRef.current?.abort()
    }
  }, [loadProgress])

  function closeCompletedGuide() {
    setGuideOpen(false)
    setShowCompletion(false)
    sessionStorage.removeItem(setupMarker(tenantId))
    forceOpenRef.current = false
    availabilityAttemptedRef.current = false
    router.replace('/admin/service-bookings', { scroll: false })
  }

  if (loading && !steps.length) return null

  if (error && !steps.length) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p role="alert">{error}</p>
        <button
          type="button"
          onClick={() => void loadProgress(true)}
          className="mt-3 min-h-11 rounded-xl border border-amber-300 bg-white px-4 py-2 font-bold"
        >
          Riprova
        </button>
      </section>
    )
  }

  if (!open && !error) return null

  return (
    <section
      aria-labelledby="setup-checklist-title"
      className="rounded-3xl border border-[#CFE7E7] bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">
            Configurazione iniziale
          </p>
          <h2 id="setup-checklist-title" className="mt-1 text-xl font-black text-[#0F1D2D] sm:text-2xl">
            {allComplete ? 'La tua attività è pronta' : 'Rendiamo la tua attività prenotabile'}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {allComplete
              ? 'I quattro passaggi sono completati. Puoi riaprire questa guida dalle Impostazioni.'
              : `Hai completato ${completedCount} passaggi su ${STEP_DETAILS.length}. Puoi interrompere quando vuoi: i dati restano salvati.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadProgress(false)}
            disabled={refreshing}
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-[#0F1D2D] hover:border-[#1FA7A6] disabled:opacity-60"
          >
            {refreshing ? 'Aggiorno…' : 'Aggiorna stato'}
          </button>
          {allComplete && (
            <button
              type="button"
              onClick={closeCompletedGuide}
              className="min-h-11 rounded-xl bg-[#0F1D2D] px-4 py-2 text-sm font-bold text-white hover:bg-[#1FA7A6]"
            >
              Torna alle prenotazioni
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      {open && (
        <ol className="mt-5 grid gap-3 md:grid-cols-2">
          {STEP_DETAILS.map((detail, index) => {
            const complete = steps.find(step => step.id === detail.id)?.complete === true
            return (
              <li
                key={detail.id}
                className={`flex min-h-28 items-start gap-3 rounded-2xl border p-4 ${
                  complete ? 'border-teal-100 bg-teal-50/60' : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <span
                  aria-label={complete ? 'Completato' : 'Da completare'}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    complete ? 'bg-[#1FA7A6] text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'
                  }`}
                >
                  {complete ? '✓' : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-black text-[#0F1D2D]">{detail.title}</h3>
                    <span className={`text-xs font-bold ${complete ? 'text-teal-700' : 'text-slate-500'}`}>
                      {complete ? 'Completato' : 'Da completare'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{detail.description}</p>
                  <Link
                    href={detail.href}
                    className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#FFC145] px-4 py-2 text-sm font-black text-[#0F1D2D] hover:brightness-95"
                  >
                    {complete ? 'Rivedi sezione' : detail.action}
                  </Link>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {showCompletion && allComplete && (
        <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 p-4" aria-live="polite">
          <p className="font-black text-teal-900">Configurazione completata</p>
          <p className="mt-1 text-sm leading-6 text-teal-900">
            Sto verificando se i clienti possono trovare almeno un orario prenotabile nei prossimi 14 giorni.
          </p>
          <div className="mt-3 text-sm">
            {availability === 'checking' && (
              <p className="font-semibold text-teal-900">Controllo in corso: {checkedDays} giorni verificati su 14…</p>
            )}
            {availability === 'available' && (
              <p className="font-bold text-teal-900">✓ Ho trovato almeno uno slot prenotabile. La pagina pubblica è pronta.</p>
            )}
            {availability === 'none' && (
              <p className="font-semibold text-amber-900">Non ho trovato slot liberi nei prossimi 14 giorni. La configurazione è completa: controlla orari, chiusure e prenotazioni presenti.</p>
            )}
            {availability === 'error' && (
              <p className="font-semibold text-amber-900">Non sono riuscito a completare il controllo automatico. La checklist resta completata; puoi verificare la pagina pubblica.</p>
            )}
            {availability !== 'checking' && (
              <button
                type="button"
                onClick={() => void runAvailabilityCheck(services, timezone)}
                className="mt-3 min-h-10 rounded-xl border border-teal-300 bg-white px-4 py-2 text-sm font-bold text-teal-900 hover:bg-teal-100"
              >
                Ricontrolla disponibilità
              </button>
            )}
          </div>
        </div>
      )}

      {open && allComplete && !showCompletion && (
        <p className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-900">
          Configurazione completata. La guida è stata riaperta dalle Impostazioni.
        </p>
      )}
    </section>
  )
}
