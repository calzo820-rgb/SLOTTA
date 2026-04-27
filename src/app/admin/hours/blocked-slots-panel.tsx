'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type HoursRow = {
  dow: number // 0=Dom ... 6=Sab
  open_time_am: string
  close_time_am: string
  pm_enabled: boolean
  open_time_pm: string
  close_time_pm: string
  is_closed: boolean
}

type Props = {
  tenantId: string
  slotMinutes: number
}

type SchemaVariant =
  | { variant: 'A'; table: 'blocked_time_slots'; dayCol: 'day'; timeCol: 'slot_time' }
  | { variant: 'B'; table: 'blocked_time_slots'; dayCol: 'blocked_date'; timeCol: 'blocked_time' }

const TABLE: 'blocked_time_slots' = 'blocked_time_slots'

function toTime5(v: string) {
  if (!v) return '00:00'
  return v.slice(0, 5)
}

function minutes(t: string) {
  const [hh, mm] = t.split(':')
  return (parseInt(hh || '0', 10) || 0) * 60 + (parseInt(mm || '0', 10) || 0)
}

function mmToTime(m: number) {
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(date: Date, delta: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + delta)
  return d
}

function dowFromIso(iso: string) {
  return new Date(`${iso}T00:00:00`).getDay()
}

function fmtDateIT(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

function Card({
  title,
  subtitle,
  children,
  right,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <section className="border rounded-2xl bg-white shadow-sm">
      <div className="px-4 py-3 border-b flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{title}</div>
          {subtitle ? <div className="text-sm text-zinc-600">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

/**
 * Prova schema A, se fallisce prova schema B.
 * Ritorna lo schema funzionante, oppure lancia un Error con messaggio chiaro.
 */
async function detectBlockedSchema(tenantId: string, selectedDate: string): Promise<SchemaVariant> {
  // Schema A: day / slot_time
  {
    const { error } = await (supabase as any)
      .from(TABLE)
      .select('id, day, slot_time')
      .eq('tenant_id', tenantId)
      .eq('day', selectedDate)
      .limit(1)

    if (!error) return { variant: 'A', table: TABLE, dayCol: 'day', timeCol: 'slot_time' }
  }

  // Schema B: blocked_date / blocked_time
  {
    const { error } = await (supabase as any)
      .from(TABLE)
      .select('id, blocked_date, blocked_time')
      .eq('tenant_id', tenantId)
      .eq('blocked_date', selectedDate)
      .limit(1)

    if (!error) return { variant: 'B', table: TABLE, dayCol: 'blocked_date', timeCol: 'blocked_time' }
  }

  throw new Error(
    `Impossibile leggere la tabella "${TABLE}". Controlla che esista e che abbia colonne (day, slot_time) oppure (blocked_date, blocked_time), e che RLS permetta la SELECT.`,
  )
}

export default function BlockedSlotsPanel({ tenantId, slotMinutes }: Props) {
  const [selectedDate, setSelectedDate] = useState<string>(isoDate(new Date()))
  const [hours, setHours] = useState<HoursRow[]>([])
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set()) // HH:MM

  const [schema, setSchema] = useState<SchemaVariant | null>(null)

  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dow = useMemo(() => dowFromIso(selectedDate), [selectedDate])

  const dayHours = useMemo(() => {
    return hours.find(h => h.dow === dow) || null
  }, [hours, dow])

  const slots = useMemo(() => {
    if (!dayHours) return []
    if (dayHours.is_closed) return []

    const step = Math.max(5, slotMinutes || 10)
    const list: string[] = []

    const amStart = minutes(toTime5(dayHours.open_time_am))
    const amEnd = minutes(toTime5(dayHours.close_time_am))
    if (amEnd > amStart) {
      for (let m = amStart; m + step <= amEnd; m += step) list.push(mmToTime(m))
    }

    if (dayHours.pm_enabled) {
      const pmStart = minutes(toTime5(dayHours.open_time_pm))
      const pmEnd = minutes(toTime5(dayHours.close_time_pm))
      if (pmEnd > pmStart) {
        for (let m = pmStart; m + step <= pmEnd; m += step) list.push(mmToTime(m))
      }
    }

    return list
  }, [dayHours, slotMinutes])

  // Load tenant_hours (once per tenant)
  useEffect(() => {
    if (!tenantId) return

    let cancelled = false

    ;(async () => {
      setError(null)
      try {
        const { data, error } = await supabase
          .from('tenant_hours')
          .select(
            'dow, open_time_am, close_time_am, pm_enabled, open_time_pm, close_time_pm, is_closed',
          )
          .eq('tenant_id', tenantId)

        if (error) throw new Error(error.message || 'Errore tenant_hours')
        if (!cancelled) setHours((data || []) as HoursRow[])
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : typeof e === 'string' ? e : 'Errore nel caricamento orari.'
        console.error('BlockedSlotsPanel hours error:', e)
        if (!cancelled) setError(msg)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tenantId])

  // Detect schema + load blocked slots for selectedDate
  useEffect(() => {
    if (!tenantId) return

    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)

      try {
        const detected = await detectBlockedSchema(tenantId, selectedDate)
        if (cancelled) return
        setSchema(detected)

        const sb = supabase as any
        const { data, error } = await sb
          .from(detected.table)
          .select(`id, ${detected.dayCol}, ${detected.timeCol}`)
          .eq('tenant_id', tenantId)
          .eq(detected.dayCol, selectedDate)

        if (error) throw new Error(error.message || 'Errore caricamento slot bloccati')

        const next = new Set<string>()
        for (const r of (data || []) as Array<Record<string, any>>) {
          const t = String(r[detected.timeCol] ?? '').slice(0, 5) // "09:00:00" -> "09:00"
          if (t) next.add(t)
        }

        if (!cancelled) setBlockedSet(next)
      } catch (e: unknown) {
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === 'string'
              ? e
              : (() => {
                  try {
                    return JSON.stringify(e)
                  } catch {
                    return 'Errore sconosciuto'
                  }
                })()

        console.error('BlockedSlotsPanel load error:', e)
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tenantId, selectedDate])

  const blockedCount = useMemo(() => {
    let c = 0
    for (const t of slots) if (blockedSet.has(t)) c++
    return c
  }, [slots, blockedSet])

const closedInfo = useMemo(() => {
  if (!dayHours) return null

  if (dayHours.is_closed) {
    return { tone: 'closed' as const, text: 'Giorno di chiusura. Seleziona un’altra data.' }
  }

  if (slots.length === 0) {
    return { tone: 'full' as const, text: 'Nessun orario disponibile per questo giorno. Prova un’altra data.' }
  }

  return null
}, [dayHours, slots.length])


  async function toggle(time: string) {
    if (!tenantId) return
    if (!schema) {
      setError('Schema non rilevato: verifica tabella blocked_time_slots.')
      return
    }

    const isBlocked = blockedSet.has(time)
    const k = `${selectedDate}|${time}`

    setSavingKey(k)
    setError(null)

    try {
      const sb = supabase as any

      if (!isBlocked) {
        const payload: any = {
          tenant_id: tenantId,
          [schema.dayCol]: selectedDate,
          [schema.timeCol]: `${time}:00`,
        }

        const { error } = await sb.from(schema.table).insert(payload)

        // dup -> ignora (clic veloce)
        if (error && (error as any)?.code !== '23505') {
          throw new Error(error.message || 'Errore insert slot bloccato')
        }

        setBlockedSet(prev => {
          const n = new Set(prev)
          n.add(time)
          return n
        })
      } else {
        const { error } = await sb
          .from(schema.table)
          .delete()
          .eq('tenant_id', tenantId)
          .eq(schema.dayCol, selectedDate)
          .eq(schema.timeCol, `${time}:00`)

        if (error) throw new Error(error.message || 'Errore delete slot bloccato')

        setBlockedSet(prev => {
          const n = new Set(prev)
          n.delete(time)
          return n
        })
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : typeof e === 'string' ? e : 'Errore salvataggio.'
      console.error('BlockedSlotsPanel toggle error:', e)
      setError(msg)
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <Card
      title="Blocca fasce orarie"
      subtitle="Disabilita singoli slot per evitare prenotazioni (es. cliente dal vivo o telefonata)."
      right={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50"
            onClick={() => setSelectedDate(isoDate(new Date()))}
          >
            Oggi
          </button>

          <button
            type="button"
            className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50"
            onClick={() => setSelectedDate(isoDate(addDays(new Date(`${selectedDate}T00:00:00`), -1)))}
          >
            ←
          </button>

          <button
            type="button"
            className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50"
            onClick={() => setSelectedDate(isoDate(addDays(new Date(`${selectedDate}T00:00:00`), +1)))}
          >
            →
          </button>
        </div>
      }
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid gap-1">
            <div className="text-[11px] text-zinc-500">Giorno</div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border rounded-xl px-3 py-2 h-10"
            />
          </div>

          <div className="text-sm text-zinc-700">
            <span className="font-semibold capitalize">{fmtDateIT(selectedDate)}</span>
            <span className="text-zinc-500"> • Slot: {slotMinutes} min</span>
          </div>

          <div className="ml-auto text-sm">
            <span className="text-zinc-500">Bloccati: </span>
            <span className="font-semibold">{blockedCount}</span>
            <span className="text-zinc-500"> / {slots.length}</span>
          </div>
        </div>

        {error ? (
          <div className="text-sm text-red-700 border rounded-xl p-3 bg-red-50">{error}</div>
        ) : null}

{closedInfo && (
  <div
    className={[
      'rounded-xl border p-3 text-sm',
      closedInfo.tone === 'closed'
        ? 'bg-red-50 border-red-200 text-red-800'
        : 'bg-amber-50 border-amber-200 text-amber-900',
    ].join(' ')}
  >
    <div className="font-semibold">
      {closedInfo.tone === 'closed' ? 'Chiuso' : 'Non disponibile'}
    </div>
    <div className="mt-1">{closedInfo.text}</div>
  </div>
)}


        <div className="border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-zinc-50 flex items-center justify-between">
            <div className="font-semibold text-sm">Slot del giorno</div>
            <div className="text-xs text-zinc-500">
              {loading
                ? 'Caricamento…'
                : savingKey
                  ? 'Salvataggio…'
                  : 'Clicca per bloccare/sbloccare'}
            </div>
          </div>

          <div className="p-4">
            {closedInfo ? (
  <div className="text-sm text-zinc-600">
    Seleziona un’altra data per vedere gli orari disponibili.
  </div>
) : slots.length === 0 ? (
  <div className="text-sm text-zinc-500">Nessuno slot.</div>
) : (
  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
    {slots.map(t => {
      const isBlocked = blockedSet.has(t)
      const isSaving = savingKey === `${selectedDate}|${t}`

      return (
        <button
          key={t}
          type="button"
          disabled={isSaving || loading}
          onClick={() => toggle(t)}
          className={`px-3 py-2 rounded-xl border text-sm transition disabled:opacity-50 ${
            isBlocked ? 'bg-zinc-900 text-white border-zinc-900' : 'hover:bg-zinc-50'
          }`}
          title={
            isBlocked
              ? 'Slot bloccato (clicca per sbloccare)'
              : 'Slot libero (clicca per bloccare)'
          }
        >
          {t}
        </button>
      )
    })}
  </div>
)}


            <div className="text-[11px] text-zinc-500 mt-4">
              Suggerimento: blocca solo gli slot necessari per quel giorno.
            </div>
          </div>
        </div>

        {schema ? (
          <div className="text-[11px] text-zinc-500">
            Schema: <span className="font-medium">{schema.variant}</span> • Tabella:{' '}
            <span className="font-medium">{schema.table}</span> • Colonne:{' '}
            <span className="font-medium">{schema.dayCol}</span> /{' '}
            <span className="font-medium">{schema.timeCol}</span>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
