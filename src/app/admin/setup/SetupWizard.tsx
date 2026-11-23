'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getNowInTimeZone } from '@/lib/bookingRequest'
import type { AvailabilityClosure } from '@/lib/bookingSlots'
import {
  hasManagerBookableSlotOnDate,
  type SetupAvailabilitySettings,
  type SetupBusySlot,
  type SetupHours,
  type SetupStaff,
  type SetupStaffHours,
} from '@/lib/managerOnboarding'
import type { SetupStep, SetupStepId } from '@/lib/managerOnboarding'

type SetupPayload = {
  tenantId: string
  completedAt: string | null
  steps: SetupStep[]
  services: Array<{ id: string; duration_minutes: number | null }>
  timezone: string
}

type PublicBookingConfig = {
  error?: string
  settings?: SetupAvailabilitySettings | null
  staff?: SetupStaff[]
  tenant_hours?: SetupHours | null
  staff_hours?: SetupStaffHours[]
  closures?: AvailabilityClosure[]
}

type PublicBusyResponse = { error?: string; bookings?: SetupBusySlot[] }
type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'none' | 'error'

const STEPS: Array<{
  id: SetupStepId | 'availability'
  title: string
  description: string
  href?: string
  action?: string
}> = [
  {
    id: 'hours',
    title: 'Orari dell’attività',
    description: 'Salva almeno una fascia di apertura valida.',
    href: '/admin/hours',
    action: 'Configura orari',
  },
  {
    id: 'staff',
    title: 'Primo operatore',
    description: 'Aggiungi un operatore attivo e verifica i suoi orari.',
    href: '/admin/staff',
    action: 'Configura operatori',
  },
  {
    id: 'services',
    title: 'Primo servizio',
    description: 'Crea un servizio attivo con durata e prezzo validi.',
    href: '/admin/services',
    action: 'Configura servizi',
  },
  {
    id: 'availability',
    title: 'Verifica pagina pubblica',
    description: 'Controlla gli orari prenotabili nei prossimi 14 giorni.',
  },
]

function addDays(date: string, amount: number) {
  const result = new Date(`${date}T00:00:00Z`)
  result.setUTCDate(result.getUTCDate() + amount)
  return result.toISOString().slice(0, 10)
}

export default function SetupWizard() {
  const router = useRouter()
  const [snapshot, setSnapshot] = useState<SetupPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availability, setAvailability] = useState<AvailabilityStatus>('idle')
  const [checkedDays, setCheckedDays] = useState(0)
  const availabilityController = useRef<AbortController | null>(null)

  const configSteps = useMemo(
    () => snapshot?.steps ?? [],
    [snapshot],
  )
  const configComplete =
    configSteps.length === 3 && configSteps.every(step => step.complete)
  const completeCount = configSteps.filter(step => step.complete).length

  const loadProgress = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/setup-progress', { cache: 'no-store' })
      const payload = await response.json() as SetupPayload & { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Impossibile leggere la configurazione.')
      setSnapshot(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Errore di caricamento.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadProgress(true)
    const onFocus = () => {
      if (document.visibilityState === 'visible') void loadProgress(false)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      availabilityController.current?.abort()
    }
  }, [loadProgress])

  async function checkAvailability() {
    if (!snapshot || !configComplete) return
    availabilityController.current?.abort()
    const controller = new AbortController()
    availabilityController.current = controller
    setAvailability('checking')
    setCheckedDays(0)

    try {
      const now = getNowInTimeZone(snapshot.timezone || 'Europe/Rome')
      const activeServices = snapshot.services.filter(
        service => Number(service.duration_minutes) > 0,
      )
      if (!activeServices.length) throw new Error('Nessun servizio attivo da verificare.')

      const durationByServiceId = Object.fromEntries(
        activeServices.map(service => [service.id, Number(service.duration_minutes)]),
      )

      for (let dayIndex = 0; dayIndex < 14; dayIndex += 1) {
        const date = addDays(now.date, dayIndex)
        const [configResponse, busyResponse] = await Promise.all([
          fetch('/api/public/booking-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
            body: JSON.stringify({ tenant_id: snapshot.tenantId, booking_date: date }),
          }),
          fetch('/api/public/booked-slots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
            body: JSON.stringify({ tenant_id: snapshot.tenantId, booking_date: date, staff_id: null }),
          }),
        ])
        const [config, busy] = await Promise.all([
          configResponse.json() as Promise<PublicBookingConfig>,
          busyResponse.json() as Promise<PublicBusyResponse>,
        ])
        if (!configResponse.ok || !busyResponse.ok) {
          throw new Error(config.error || busy.error || 'Controllo disponibilità non riuscito.')
        }

        const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
        const hasSlot = activeServices.some(service =>
          hasManagerBookableSlotOnDate({
            date,
            currentDate: now.date,
            currentMinutes: now.minutes,
            serviceId: service.id,
            durationByServiceId,
            settings: config.settings || null,
            staff: config.staff || [],
            tenantHours: config.tenant_hours || null,
            staffHours: (config.staff_hours || []).filter(row => row.dow === dow),
            closures: config.closures || [],
            busySlots: busy.bookings || [],
          }),
        )
        setCheckedDays(dayIndex + 1)
        if (hasSlot) {
          setAvailability('available')
          return
        }
      }
      setAvailability('none')
    } catch (checkError) {
      if (checkError instanceof DOMException && checkError.name === 'AbortError') return
      setAvailability('error')
    }
  }

  async function finishSetup() {
    if (!configComplete) return
    if (!snapshot?.completedAt && !['available', 'none', 'error'].includes(availability)) return

    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/setup-progress', { method: 'POST' })
      const payload = await response.json() as SetupPayload & { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Impossibile completare la configurazione.')
      setSnapshot(payload)
      router.replace('/admin/service-bookings')
      router.refresh()
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : 'Errore nel completamento.')
      await loadProgress(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !snapshot) {
    return <main className="mx-auto max-w-3xl p-5 text-sm text-slate-600">Carico la configurazione…</main>
  }

  const alreadyCompleted = Boolean(snapshot?.completedAt)
  const checkDone = ['available', 'none', 'error'].includes(availability)

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-[#F2F4F7] px-4 py-6 pb-24 text-[#0F1D2D] md:px-6">
      <div className="mx-auto grid max-w-3xl gap-5">
        <header className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">Configurazione iniziale</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
            {alreadyCompleted ? 'Rivedi la configurazione' : 'Prepariamo la tua attività alle prenotazioni'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {alreadyCompleted
              ? 'La guida iniziale è già completata. Puoi controllare i dati o verificare di nuovo la pagina pubblica.'
              : `Completa i passaggi in qualsiasi ordine. I dati vengono salvati nelle sezioni esistenti e puoi riprendere quando vuoi. (${completeCount} su 3 configurazioni completate)`}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${completeCount} configurazioni su 3 completate`}>
            <div className="h-full rounded-full bg-[#1FA7A6] transition-all" style={{ width: `${(completeCount / 3) * 100}%` }} />
          </div>
        </header>

        {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}

        <ol className="grid gap-3">
          {STEPS.map((step, index) => {
            const complete = step.id === 'availability'
              ? availability === 'available' || availability === 'none' || alreadyCompleted
              : configSteps.find(item => item.id === step.id)?.complete === true
            return (
              <li key={step.id} className={`rounded-3xl border bg-white p-4 shadow-sm sm:p-5 ${complete ? 'border-teal-200' : 'border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${complete ? 'bg-[#1FA7A6] text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {complete ? '✓' : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-black">{step.title}</h2>
                      <span className={`text-xs font-bold ${complete ? 'text-teal-700' : 'text-slate-500'}`}>
                        {complete ? 'Completato' : 'Da completare'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{step.description}</p>
                    {step.href && step.action ? (
                      <Link href={step.href} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#FFC145] px-4 py-2 text-sm font-black hover:brightness-95">
                        {complete ? 'Rivedi sezione' : step.action}
                      </Link>
                    ) : (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => void checkAvailability()}
                          disabled={!configComplete || availability === 'checking' || refreshing}
                          className="min-h-11 rounded-xl bg-[#0F1D2D] px-4 py-2 text-sm font-black text-white hover:bg-[#1FA7A6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {availability === 'checking' ? `Controllo in corso (${checkedDays}/14)…` : availability === 'available' || availability === 'none' || availability === 'error' ? 'Ricontrolla disponibilità' : 'Verifica disponibilità'}
                        </button>
                        {availability === 'available' && <p role="status" className="mt-3 text-sm font-semibold text-teal-800">Ho trovato almeno uno slot prenotabile: la pagina pubblica può ricevere prenotazioni.</p>}
                        {availability === 'none' && <p role="status" className="mt-3 text-sm font-semibold text-amber-800">Non ci sono slot liberi nei prossimi 14 giorni. Se orari e configurazione sono corretti, puoi comunque completare la guida.</p>}
                        {availability === 'error' && <p role="alert" className="mt-3 text-sm font-semibold text-amber-800">Non sono riuscito a verificare la disponibilità. Puoi riprovare o completare comunque dopo aver controllato i passaggi precedenti.</p>}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        {!alreadyCompleted ? (
          <button
            type="button"
            onClick={() => void finishSetup()}
            disabled={!configComplete || saving || availability === 'checking' || !checkDone}
            className="min-h-12 rounded-2xl bg-[#FFC145] px-5 py-3 text-base font-black text-[#0F1D2D] shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Completo la configurazione…' : availability === 'error' ? 'Completa comunque' : availability === 'none' ? 'Completa e accedi alla dashboard' : 'Completa configurazione'}
          </button>
        ) : (
          <button type="button" onClick={() => router.push('/admin/service-bookings')} className="min-h-12 rounded-2xl bg-[#FFC145] px-5 py-3 text-base font-black text-[#0F1D2D] shadow-sm hover:brightness-95">
            Torna alla dashboard
          </button>
        )}

        {!configComplete && !alreadyCompleted && (
          <p className="text-center text-sm text-slate-600">Puoi interrompere qui e uscire: al prossimo accesso riprenderai da questi dati.</p>
        )}
        <button type="button" onClick={() => void loadProgress(false)} disabled={refreshing} className="mx-auto min-h-11 rounded-xl px-4 text-sm font-bold text-slate-600 underline disabled:opacity-50">
          {refreshing ? 'Aggiorno…' : 'Aggiorna stato dei passaggi'}
        </button>
      </div>
    </main>
  )
}
