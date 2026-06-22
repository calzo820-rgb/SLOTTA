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

const TABLE = 'blocked_time_slots' as const

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
  title: React.ReactNode
  subtitle?: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-[#F8FAFC] px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
            Fasce orarie
          </p>

          <div className="mt-1 text-xl font-black text-[#0F1D2D]">
            {title}
          </div>

          {subtitle ? (
            <div className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {subtitle}
            </div>
          ) : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      {children}
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
    const { error } = await supabase
  .from(TABLE)
      .select('id, day, slot_time')
      .eq('tenant_id', tenantId)
      .eq('day', selectedDate)
      .limit(1)

    if (!error) return { variant: 'A', table: TABLE, dayCol: 'day', timeCol: 'slot_time' }
  }

  // Schema B: blocked_date / blocked_time
  {
  const { error } = await supabase
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
const [mobileOpen, setMobileOpen] = useState(false)
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

       const { data, error } = await supabase
  .from(detected.table)
          .select(`id, ${detected.dayCol}, ${detected.timeCol}`)
          .eq('tenant_id', tenantId)
          .eq(detected.dayCol, selectedDate)

        if (error) throw new Error(error.message || 'Errore caricamento slot bloccati')

        const next = new Set<string>()
        for (const r of (data || []) as Array<Record<string, unknown>>) {
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
      if (!isBlocked) {
        const end = mmToTime(minutes(time) + slotMinutes)

const payload: Record<string, string> = {
  tenant_id: tenantId,
  [schema.dayCol]: selectedDate,
  [schema.timeCol]: `${time}:00`,
  block_date: selectedDate,
  start_time: `${time}:00`,
  end_time: `${end}:00`,
}

        const { error } = await supabase.from(schema.table).insert(payload)

        // dup -> ignora (clic veloce)
        if (error && error.code !== '23505') {
          throw new Error(error.message || 'Errore insert slot bloccato')
        }

        setBlockedSet(prev => {
          const n = new Set(prev)
          n.add(time)
          return n
        })
      } else {
       const { error } = await supabase
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
    title={
      <button
        type="button"
        onClick={() => setMobileOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3 text-left md:cursor-default"
      >
        <span>Blocca fasce orarie</span>
        <span className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#0F1D2D] md:hidden">
  {mobileOpen ? '▲' : '▼'}
</span>
      </button>
    }
    subtitle="Disabilita singoli slot per evitare prenotazioni quando hai impegni, telefonate o appuntamenti presi fuori da Slotta."
  >
    <div className={`${mobileOpen ? 'grid' : 'hidden'} gap-4 p-5 md:grid`}>
      {/* DATA + SUMMARY */}
      <div className="flex flex-wrap items-center gap-2">
  <button
    type="button"
    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
    onClick={() => setSelectedDate(isoDate(new Date()))}
  >
    Oggi
  </button>

  <button
    type="button"
    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
    onClick={() =>
      setSelectedDate(
        isoDate(addDays(new Date(`${selectedDate}T00:00:00`), -1)),
      )
    }
  >
    ← Giorno prima
  </button>

  <button
    type="button"
    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
    onClick={() =>
      setSelectedDate(
        isoDate(addDays(new Date(`${selectedDate}T00:00:00`), +1)),
      )
    }
  >
    Giorno dopo →
  </button>
</div>
      <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
        <div className="grid gap-1">
          <div className="text-xs font-bold text-slate-500">Giorno</div>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3">
          <div className="text-xs font-black uppercase tracking-wide text-slate-400">
            Giorno selezionato
          </div>
          <div className="mt-1 text-sm font-black capitalize text-[#0F1D2D]">
            {fmtDateIT(selectedDate)}
          </div>
          <div className="mt-0.5 text-xs font-medium text-slate-500">
            Slot da {slotMinutes} minuti
          </div>
        </div>

        <div className="rounded-2xl bg-[#0F1D2D] px-4 py-3 text-white">
          <div className="text-xs font-bold text-slate-300">Bloccati</div>
          <div className="text-xl font-black">
            {blockedCount}
            <span className="text-sm font-bold text-slate-300"> / {slots.length}</span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {closedInfo && (
        <div
          className={[
            'rounded-2xl border p-4 text-sm',
            closedInfo.tone === 'closed'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-amber-200 bg-amber-50 text-amber-900',
          ].join(' ')}
        >
          <div className="font-black">
            {closedInfo.tone === 'closed' ? 'Chiuso' : 'Non disponibile'}
          </div>
          <div className="mt-1 leading-6">{closedInfo.text}</div>
        </div>
      )}

      {/* SLOT GRID */}
      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-100 bg-[#F8FAFC] px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-black text-[#0F1D2D]">Slot del giorno</div>
            <div className="mt-0.5 text-xs font-medium text-slate-500">
              Clicca su un orario per bloccarlo o sbloccarlo.
            </div>
          </div>

          <div className="text-xs font-bold text-slate-500">
            {loading
              ? 'Caricamento…'
              : savingKey
                ? 'Salvataggio…'
                : 'Pronto'}
          </div>
        </div>

        <div className="p-4">
          {closedInfo ? (
            <div className="rounded-2xl bg-[#F8FAFC] p-4 text-sm text-slate-600">
              Seleziona un’altra data per vedere gli orari disponibili.
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl bg-[#F8FAFC] p-4 text-sm text-slate-500">
              Nessuno slot disponibile.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {slots.map(t => {
                const isBlocked = blockedSet.has(t)
                const isSaving = savingKey === `${selectedDate}|${t}`

                return (
                  <button
                    key={t}
                    type="button"
                    disabled={isSaving || loading}
                    onClick={() => toggle(t)}
                    className={[
                      'min-h-[44px] rounded-2xl border px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50',
                      isBlocked
                        ? 'border-[#0F1D2D] bg-[#0F1D2D] text-white shadow-sm'
                        : 'border-slate-200 bg-white text-[#0F1D2D] hover:border-[#1FA7A6] hover:text-[#1FA7A6]',
                    ].join(' ')}
                    title={
                      isBlocked
                        ? 'Slot bloccato (clicca per sbloccare)'
                        : 'Slot libero (clicca per bloccare)'
                    }
                  >
                    {isSaving ? '…' : t}
                  </button>
                )
              })}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] px-3 py-1.5">
              <span className="h-2 w-2 rounded-full border border-slate-300 bg-white" />
              Libero
            </span>

            <span className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#0F1D2D]" />
              Bloccato
            </span>

            <span className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#FFC145]" />
              Suggerimento: blocca solo gli slot necessari
            </span>
          </div>
        </div>
      </div>
    </div>
  </Card>
)
}
