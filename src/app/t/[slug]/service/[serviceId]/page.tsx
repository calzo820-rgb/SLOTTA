'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Tenant = {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  primary_color?: string | null
  tenant_mode?: string | null
}
type HoursRowDb = {
  dow: number
  is_closed: boolean | null

  // nuovo schema
  open_time_am: string | null
  close_time_am: string | null
  pm_enabled: boolean | null
  open_time_pm: string | null
  close_time_pm: string | null

  // vecchio schema (legacy)
  open_time: string | null
  close_time: string | null

  // alcuni DB hanno questo
  has_split?: boolean | null
}

type Service = {
  id: string
  name: string
  description?: string | null
  duration_minutes: number
  price_cents: number
  image_url?: string | null
}

type TenantSettings = {
  slot_minutes: number
  lead_time_minutes: number
  timezone: string
  service_staff_count: number
}

type HoursRowNew = {
  dow: number // 0=Dom ... 6=Sab
  open_time_am: string
  close_time_am: string
  pm_enabled: boolean
  open_time_pm: string
  close_time_pm: string
  is_closed: boolean
}

// schema vecchio (fallback)
type HoursRowOld = {
  dow: number
  open_time: string
  close_time: string
  is_closed: boolean
}

type BookingRow = {
  booking_time: string
  status: 'pending' | 'confirmed' | 'done' | 'cancelled'
}

const DEFAULT_SETTINGS: TenantSettings = {
  slot_minutes: 10,
  lead_time_minutes: 20,
  timezone: 'Europe/Rome',
  service_staff_count: 1,
}

function euro(cents: number) {
  return (cents / 100).toFixed(2)
}

function toTime5(v: string) {
  // "09:00:00" -> "09:00"
  if (!v) return '00:00'
  return v.slice(0, 5)
}

function minutesFromHHMM(t: string) {
  const [hh, mm] = (t || '00:00').split(':')
  return (parseInt(hh || '0', 10) || 0) * 60 + (parseInt(mm || '0', 10) || 0)
}

function mmToTime(m: number) {
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function isoDateLocal(d = new Date()) {
  // evita problemi di timezone tipici di toISOString()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseIsoToLocalDate(iso: string) {
  const [y, m, d] = String(iso || '').split('-').map(n => parseInt(n, 10))
  return new Date(y || 1970, (m || 1) - 1, d || 1, 0, 0, 0, 0) // ✅ locale, no timezone shift
}

function dowFromIso(iso: string) {
  return parseIsoToLocalDate(iso).getDay() // 0=Dom ... 6=Sab
}

function addDaysIso(iso: string, delta: number) {
  const d = parseIsoToLocalDate(iso)
  d.setDate(d.getDate() + delta)
  return isoDateLocal(d)
}


function nowMinutesToday() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}


async function detectBlockedSchema(tenantId: string) {
  // tenta a leggere UNA riga, così capiamo i nomi colonne disponibili
  // (serve che RLS permetta SELECT al client)
  const TABLE = 'blocked_time_slots'

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .limit(1)

  if (error) {
    throw new Error(
      `Impossibile leggere la tabella "${TABLE}". Controlla che esista e che RLS permetta la SELECT.`,
    )
  }

  const row = (data && data[0]) || null
  // se tabella vuota, assumo schema standard (quello che abbiamo appena creato)
  if (!row) {
    return { table: TABLE, dayCol: 'day', timeCol: 'blocked_time' }
  }

  const keys = Object.keys(row)

  const dayCol =
    (keys.includes('day') && 'day') ||
    (keys.includes('blocked_date') && 'blocked_date') ||
    (keys.includes('date') && 'date') ||
    'day'

  const timeCol =
    (keys.includes('blocked_time') && 'blocked_time') ||
    (keys.includes('slot_time') && 'slot_time') ||
    (keys.includes('time') && 'time') ||
    'blocked_time'

  return { table: TABLE, dayCol, timeCol }
}

export default function ServiceBookingPage({
  params,
}: {
  params: { slug: string; serviceId: string }
}) {
  const { slug, serviceId } = params

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [service, setService] = useState<Service | null>(null)
  const [settings, setSettings] = useState<TenantSettings>(DEFAULT_SETTINGS)
  

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(isoDateLocal(new Date()))
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // disponibilità
  const [blockedTimes, setBlockedTimes] = useState<Set<string>>(new Set()) // "HH:MM"
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({}) // "HH:MM" -> count
  const [availabilityLoading, setAvailabilityLoading] = useState(false)

const [dayHours, setDayHours] = useState<HoursRowNew | null>(null)
const dow = useMemo(() => dowFromIso(date), [date])


  const mainColor = tenant?.primary_color || '#111111'

  // --- carica tenant + service + settings + hours ---
  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        // tenant
        const { data: tenants, error: tErr } = await supabase
          .from('tenants')
          .select('id, name, slug, logo_url, primary_color, tenant_mode')
          .eq('slug', slug)
          .limit(1)

        if (tErr) throw tErr
        const t = (tenants || [])[0] as any
        if (!t) throw new Error('Locale non trovato.')
        if (t.tenant_mode !== 'service')
          throw new Error('Questo locale non è configurato come venditore di servizi.')

        const tenantObj: Tenant = {
          id: t.id,
          name: t.name,
          slug: t.slug,
          logo_url: t.logo_url,
          primary_color: t.primary_color,
          tenant_mode: t.tenant_mode,
        }
        setTenant(tenantObj)

        // service
        const { data: svc, error: sErr } = await supabase
          .from('services')
          .select('id, name, description, duration_minutes, price_cents, image_url, tenant_id')
          .eq('id', serviceId)
          .eq('tenant_id', tenantObj.id)
          .single()

        if (sErr) throw sErr
        if (!svc) throw new Error('Servizio non trovato.')

        setService({
          id: svc.id,
          name: svc.name,
          description: svc.description,
          duration_minutes: svc.duration_minutes,
          price_cents: svc.price_cents,
          image_url: svc.image_url,
        })

        // settings
        const { data: st, error: stErr } = await supabase
          .from('tenant_settings')
          .select('slot_minutes, lead_time_minutes, timezone, service_staff_count')
          .eq('tenant_id', tenantObj.id)
          .single()

        if (!stErr && st) {
          setSettings({
            slot_minutes: st.slot_minutes ?? DEFAULT_SETTINGS.slot_minutes,
            lead_time_minutes: st.lead_time_minutes ?? DEFAULT_SETTINGS.lead_time_minutes,
            timezone: st.timezone || DEFAULT_SETTINGS.timezone,
            service_staff_count: st.service_staff_count ?? DEFAULT_SETTINGS.service_staff_count,
          })
        } else {
          // se non esiste o RLS limita, teniamo default
          setSettings(DEFAULT_SETTINGS)
        }

        // hours

        setLoading(false)
      } catch (e: any) {
        console.error(e)
        setError(e?.message || 'Errore durante il caricamento.')
        setLoading(false)
      }
    })()
  }, [slug, serviceId])
useEffect(() => {
  if (!tenant?.id) return
  if (!date) return

  let cancelled = false

  ;(async () => {
    try {
      setDayHours(null)

      const { data, error } = await supabase
        .from('tenant_hours')
        .select(
          `
          dow,
          is_closed,
          open_time_am,
          close_time_am,
          pm_enabled,
          open_time_pm,
          close_time_pm,
          open_time,
          close_time,
          has_split
        `,
        )
        .eq('tenant_id', tenant.id)
        .eq('dow', dow)
        .single()

      if (error) throw error

            const r = data as unknown as HoursRowDb
console.log('HOURS RAW', { date, dow, r })

      const amOpen = (r.open_time_am || r.open_time || '09:00:00') as string
      const amClose = (r.close_time_am || r.close_time || '12:30:00') as string

      // ✅ pomeriggio: attivo se pm_enabled true OR has_split true OR se ci sono orari PM valorizzati
      const pmEnabled =
        Boolean(r.pm_enabled) ||
        Boolean(r.has_split) ||
        (Boolean(r.open_time_pm) && Boolean(r.close_time_pm))

      const pmOpen = (r.open_time_pm || '15:00:00') as string
      const pmClose = (r.close_time_pm || '19:00:00') as string

      const normalized: HoursRowNew = {
        dow: r.dow,
        is_closed: Boolean(r.is_closed),
        open_time_am: amOpen,
        close_time_am: amClose,
        pm_enabled: pmEnabled,
        open_time_pm: pmOpen,
        close_time_pm: pmClose,
      }
console.log('HOURS NORMALIZED', normalized)

      if (!cancelled) setDayHours(normalized)

    } catch (e: any) {
      console.error('Errore load day hours:', e)
      if (!cancelled) setDayHours(null)
    }
  })()

  return () => {
    cancelled = true
  }
}, [tenant?.id, dow])

  // --- genera slots del giorno in base a tenant_hours + slot_minutes ---
    const slots = useMemo(() => {
    if (!dayHours) return []
    if (dayHours.is_closed) return []

    const step = Math.max(5, settings.slot_minutes || 10)

    const list: string[] = []

    const addRange = (startRaw: string | null | undefined, endRaw: string | null | undefined) => {
      const start = minutesFromHHMM(String(startRaw || ''))
      const end = minutesFromHHMM(String(endRaw || ''))
      if (!Number.isFinite(start) || !Number.isFinite(end)) return
      if (end <= start) return

      for (let m = start; m + step <= end; m += step) {
        list.push(mmToTime(m))
      }
    }

    // AM sempre (se valido)
    addRange(dayHours.open_time_am, dayHours.close_time_am)

    // ✅ PM: NON guardo pm_enabled. Lo aggiungo se gli orari PM sono validi.
    addRange(dayHours.open_time_pm, dayHours.close_time_pm)

    // dedup + sort (in minuti)
    const uniq = Array.from(new Set(list))
    uniq.sort((a, b) => minutesFromHHMM(a) - minutesFromHHMM(b))
    return uniq
  }, [dayHours, settings.slot_minutes])


  // --- carica blocked + bookings (per disabilitare slot) quando cambia data ---
  useEffect(() => {
    if (!tenant?.id) return
    if (!date) return

    let cancelled = false

    ;(async () => {
      try {
        setAvailabilityLoading(true)

        // 1) blocked slots
        const schema = await detectBlockedSchema(tenant.id)
        const sb: any = supabase as any

        const { data: blkRows, error: blkErr } = await sb
          .from(schema.table)
          .select(`id, ${schema.dayCol}, ${schema.timeCol}`)
          .eq('tenant_id', tenant.id)
          .eq(schema.dayCol, date)

        if (blkErr) throw blkErr

        const blk = new Set<string>()
        for (const r of blkRows || []) {
          const t = String(r[schema.timeCol] ?? '').slice(0, 5)
          if (t) blk.add(t)
        }

        // 2) prenotazioni esistenti per quello slot (capacità)
        const { data: bRows, error: bErr } = await supabase
          .from('service_bookings')
          .select('booking_time, status')
          .eq('tenant_id', tenant.id)
          .eq('booking_date', date)

        if (bErr) throw bErr

        const counts: Record<string, number> = {}
        ;((bRows || []) as BookingRow[]).forEach(b => {
          if (b.status === 'cancelled') return
          const t = String(b.booking_time || '').slice(0, 5)
          if (!t) return
          counts[t] = (counts[t] || 0) + 1
        })

        if (!cancelled) {
          setBlockedTimes(blk)
          setSlotCounts(counts)
        }
      } catch (e: any) {
        console.error(e)
        if (!cancelled) {
          // se fallisce per RLS su blocked_time_slots, almeno mostriamo gli slot orari corretti
          setBlockedTimes(new Set())
          setSlotCounts({})
        }
      } finally {
        if (!cancelled) setAvailabilityLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tenant?.id, date])

  // --- disabilita slot passati (oggi) in base al lead time ---
  const disabledByTime = useMemo(() => {
    const set = new Set<string>()
    if (!date) return set

    const todayIso = isoDateLocal(new Date())
    if (date !== todayIso) return set

    const minNow = nowMinutesToday() + (settings.lead_time_minutes || 0)
    for (const t of slots) {
      if (minutesFromHHMM(t) < minNow) set.add(t)
    }
    return set
  }, [date, slots, settings.lead_time_minutes])

  function isSlotDisabled(t: string) {
    if (!dayHours || dayHours.is_closed) return true
    if (blockedTimes.has(t)) return true
    if (disabledByTime.has(t)) return true

    const cap = Math.max(1, settings.service_staff_count || 1)
    const used = slotCounts[t] || 0
    if (used >= cap) return true

    return false
  }

  async function submitBooking() {
    if (!tenant || !service) return
    if (!name || !date || !time) {
      alert('Compila almeno nome, data e ora.')
      return
    }
    if (isSlotDisabled(time)) {
      alert('Questo orario non è disponibile. Scegli un altro slot.')
      return
    }

    setSubmitting(true)
    setSuccessMessage(null)

    try {
      const { error: insErr } = await supabase.from('service_bookings').insert({
        tenant_id: tenant.id,
        service_id: service.id,
        customer_name: name,
        customer_phone: phone || null,
        booking_date: date,
        booking_time: time, // "HH:MM"
        note: note || null,
        status: 'pending',
        payment_status: 'unpaid',
      })

      if (insErr) throw insErr

      setSuccessMessage('Prenotazione inviata! Ti contatteremo per confermare.')
    } catch (e: any) {
      console.error(e)
      alert(e?.message || 'Errore durante la prenotazione.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="p-6">Caricamento…</main>

  if (error || !tenant || !service) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <p className="text-red-600 text-sm mb-3">{error || 'Errore.'}</p>
        <a
          href={`/t/${slug}`}
          className="inline-block px-4 py-2 rounded bg-black text-white text-sm"
        >
          Torna al menù servizi
        </a>
      </main>
    )
  }

  return (
    <main className="p-6">
      <div className="max-w-3xl mx-auto grid gap-4">
        {/* Header */}
        <header className="flex items-center gap-3 mb-2">
          {tenant.logo_url && (
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="h-10 w-10 object-contain"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold" style={{ color: mainColor }}>
              {tenant.name}
            </h1>
            <div className="text-sm text-zinc-600">
              Prenotazione: <span className="font-semibold">{service.name}</span>
            </div>
          </div>
        </header>

        {/* Card servizio */}
        <section className="border rounded-lg bg-white p-4 flex gap-4">
          {service.image_url ? (
            <img
              src={service.image_url}
              alt={service.name}
              className="w-28 h-28 object-cover rounded"
            />
          ) : (
            <div className="w-28 h-28 rounded bg-zinc-100 flex items-center justify-center text-xs text-zinc-500">
              Nessuna immagine
            </div>
          )}

          <div className="flex-1">
            <div className="font-semibold text-lg">{service.name}</div>
            {service.description && (
              <div className="text-sm text-zinc-700 mt-1">{service.description}</div>
            )}
            <div className="mt-2 text-sm flex gap-4">
              <span>
                Durata: <span className="font-medium">{service.duration_minutes} min</span>
              </span>
              <span>
                Prezzo: <span className="font-medium">€ {euro(service.price_cents)}</span>
              </span>
            </div>
          </div>
        </section>

        {/* Step 1: Giorno + Orario */}
        <section className="border rounded-lg bg-white p-4">
          <h2 className="font-semibold mb-3 text-lg">1) Giorno e orario</h2>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col text-sm">
              <span className="mb-1">Giorno</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded border text-sm hover:bg-zinc-50"
                  onClick={() => setDate(addDaysIso(date, -1))}
                >
                  ←
                </button>
                <input
                  type="date"
                  value={date}
                  onChange={e => {
                    setDate(e.target.value)
                    setTime('')
                    setSuccessMessage(null)
                  }}
                  className="border rounded px-3 py-2"
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded border text-sm hover:bg-zinc-50"
                  onClick={() => setDate(addDaysIso(date, +1))}
                >
                  →
                </button>
              </div>
              <button
                type="button"
                className="mt-2 text-xs underline text-zinc-600 w-fit"
                onClick={() => {
                  const today = isoDateLocal(new Date())
                  setDate(today)
                  setTime('')
                }}
              >
                Vai a oggi
              </button>
            </div>

            <div className="text-xs text-zinc-500">
              Slot: <span className="font-medium">{settings.slot_minutes} min</span> • Lead time:{' '}
              <span className="font-medium">{settings.lead_time_minutes} min</span> • Capacità:{' '}
              <span className="font-medium">{settings.service_staff_count}</span>
              {availabilityLoading ? <span className="ml-2">• Caricamento disponibilità…</span> : null}
            </div>
            <div className="mt-2 text-[11px] text-red-600 break-all">
  <div><b>DEBUG dayHours:</b> {JSON.stringify(dayHours)}</div>
  <div><b>DEBUG slots:</b> {slots.join(', ')}</div>
</div>

          </div>

          <div className="mt-4">
            {!dayHours ? (
              <div className="text-sm text-zinc-600">
                Orari non configurati per questo salone.
              </div>
            ) : dayHours.is_closed ? (
              <div className="text-sm text-zinc-600">Il salone è chiuso in questo giorno.</div>
            ) : slots.length === 0 ? (
              <div className="text-sm text-zinc-600">Nessuno slot disponibile in base agli orari.</div>
            ) : (
              <>
                <div className="text-sm font-medium mb-2">Orario</div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {slots.map(t => {
                    const disabled = isSlotDisabled(t)
                    const selected = time === t

                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTime(t)}
                        disabled={disabled}
                        className={`px-3 py-2 rounded-xl border text-sm transition
                          ${disabled ? 'opacity-35 cursor-not-allowed' : 'hover:bg-zinc-50'}
                          ${selected ? 'bg-black text-white border-black' : ''}
                        `}
                      >
                        {t}
                      </button>
                    )
                  })}
                </div>

                <div className="text-[11px] text-zinc-500 mt-3">
                  Gli orari mostrati sono presi dagli <b>orari di apertura</b> del gestore e vengono
                  disabilitati se bloccati o se la capacità è piena.
                </div>
              </>
            )}
          </div>
        </section>

        {/* Step 2: Dati prenotazione */}
        <section className="border rounded-lg bg-white p-4">
          <h2 className="font-semibold mb-3 text-lg">2) I tuoi dati</h2>

          {successMessage && <div className="mb-3 text-sm text-green-700">{successMessage}</div>}

          <div className="grid gap-3">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome e cognome"
              className="border rounded px-3 py-2 text-sm"
            />

            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Telefono (opzionale)"
              className="border rounded px-3 py-2 text-sm"
            />

            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Note (es. preferenze, richieste particolari)"
              className="border rounded px-3 py-2 text-sm"
              rows={3}
            />

            <div className="flex items-center justify-between mt-2">
              <a href={`/t/${slug}`} className="text-sm underline text-zinc-600">
                ⟵ Torna alla lista servizi
              </a>

              <button
                onClick={submitBooking}
                disabled={submitting || !time}
                className="px-4 py-2 rounded text-white text-sm disabled:opacity-60"
                style={{ background: mainColor }}
              >
                {submitting ? 'Invio…' : time ? `Prenota ${time}` : 'Scegli un orario'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
