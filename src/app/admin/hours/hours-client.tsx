'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import BlockedSlotsPanel from './blocked-slots-panel'

type HoursRow = {
  dow: number // 0=Dom ... 6=Sab (JS)
  open_time_am: string
  close_time_am: string
  pm_enabled: boolean
  open_time_pm: string
  close_time_pm: string
  is_closed: boolean
}

type Settings = {
  slot_minutes: number
  lead_time_minutes: number
  timezone: string
  service_staff_count: number
  payment_mode_default: 'online' | 'in_person' | 'client_choice'
  staff_assign_mode: 'first_free' | 'round_robin'
  staff_selection_mode: 'client_choice' | 'auto_only'
}

const DOW_LABEL: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Gio',
  5: 'Ven',
  6: 'Sab',
  0: 'Dom',
}
const DOW_ORDER: number[] = [1, 2, 3, 4, 5, 6, 0]

function toTime5(v: string) {
  if (!v) return '09:00'
  return v.slice(0, 5)
}

function toTime8(v: string) {
  if (!v) return '09:00:00'
  return v.length === 5 ? `${v}:00` : v
}

function timeToMinutes(t: string) {
  const [hh, mm] = String(t || '0:0').split(':')
  return (parseInt(hh || '0', 10) || 0) * 60 + (parseInt(mm || '0', 10) || 0)
}

function minutesToTime(min: number) {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

function errToString(e: any) {
  if (!e) return ''
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message

  const msg = typeof e.message === 'string' ? e.message : ''
  const code = typeof e.code === 'string' ? e.code : ''
  const details = typeof e.details === 'string' ? e.details : ''
  const hint = typeof e.hint === 'string' ? e.hint : ''

  const parts = [
    msg,
    code && `code=${code}`,
    details && `details=${details}`,
    hint && `hint=${hint}`,
  ].filter(Boolean)

  if (parts.length) return parts.join(' | ')

  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1">
      <div className="text-[11px] text-zinc-500">{label}</div>
      {children}
      {hint ? <div className="text-[11px] text-zinc-500">{hint}</div> : null}
    </div>
  )
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

export default function HoursClient({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<HoursRow[]>([])
  const [settings, setSettings] = useState<Settings>({
    slot_minutes: 10,
    lead_time_minutes: 20,
    timezone: 'Europe/Rome',
    service_staff_count: 1,
    payment_mode_default: 'in_person',
    staff_assign_mode: 'first_free',
    staff_selection_mode: 'client_choice',
  })

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFlag, setSavedFlag] = useState(false)

  function defaultRow(dow: number): HoursRow {
    return {
      dow,
      open_time_am: '09:00:00',
      close_time_am: '12:30:00',
      pm_enabled: true,
      open_time_pm: '15:00:00',
      close_time_pm: '19:00:00',
      is_closed: dow === 0,
    }
  }

  function updateRow(dow: number, patch: Partial<HoursRow>) {
    setRows(prev => prev.map(r => (r.dow === dow ? { ...r, ...patch } : r)))
    setSavedFlag(false)
  }

  useEffect(() => {
    if (!tenantId) return

    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)

      try {
        let stRow: any = null

        const { data: st, error: stErr } = await supabase
          .from('tenant_settings')
          .select('*')
          .eq('tenant_id', tenantId)
          .single()

        if (stErr) {
          const { error: insErr } = await supabase
            .from('tenant_settings')
            .insert({ tenant_id: tenantId })

          if (insErr) throw insErr

          const { data: st2, error: st2Err } = await supabase
            .from('tenant_settings')
            .select('*')
            .eq('tenant_id', tenantId)
            .single()

          if (st2Err) throw st2Err
          stRow = st2
        } else {
          stRow = st
        }

        if (!cancelled) {
          setSettings({
            slot_minutes: stRow?.slot_minutes ?? 10,
            lead_time_minutes: stRow?.lead_time_minutes ?? 20,
            timezone: stRow?.timezone || 'Europe/Rome',
            service_staff_count: stRow?.service_staff_count ?? 1,
            payment_mode_default: (stRow?.payment_mode_default ||
              'in_person') as Settings['payment_mode_default'],
            staff_assign_mode: (stRow?.staff_assign_mode ||
              'first_free') as Settings['staff_assign_mode'],
              staff_selection_mode: (stRow?.staff_selection_mode ||
  'client_choice') as Settings['staff_selection_mode'],
          })
        }

        let hh: any[] = []

        const { data: hhNew, error: hErrNew } = await supabase
          .from('tenant_hours')
          .select(
            'dow, open_time_am, close_time_am, pm_enabled, open_time_pm, close_time_pm, is_closed',
          )
          .eq('tenant_id', tenantId)

        if (!hErrNew) {
          hh = hhNew || []
        } else {
          const { data: hhOld, error: hErrOld } = await supabase
            .from('tenant_hours')
            .select('dow, open_time, close_time, is_closed')
            .eq('tenant_id', tenantId)

          if (hErrOld) throw hErrOld

          hh = (hhOld || []).map((r: any) => ({
            dow: r.dow,
            open_time_am: r.open_time || '09:00:00',
            close_time_am: r.close_time || '19:00:00',
            pm_enabled: false,
            open_time_pm: '15:00:00',
            close_time_pm: '19:00:00',
            is_closed: r.is_closed ?? false,
          }))
        }

        const map = new Map<number, any>()
        ;(hh || []).forEach((r: any) => map.set(r.dow, r))

        const full: HoursRow[] = Array.from({ length: 7 }, (_, d) => {
          const r = map.get(d)
          const base = defaultRow(d)
          return {
            ...base,
            open_time_am: r?.open_time_am ?? base.open_time_am,
            close_time_am: r?.close_time_am ?? base.close_time_am,
            pm_enabled: r?.pm_enabled ?? base.pm_enabled,
            open_time_pm: r?.open_time_pm ?? base.open_time_pm,
            close_time_pm: r?.close_time_pm ?? base.close_time_pm,
            is_closed: r?.is_closed ?? base.is_closed,
          }
        })

        if (!cancelled) {
          setRows(full)
          setSavedFlag(true)
        }
      } catch (e: any) {
        console.error(e)
        if (!cancelled) {
          setError(errToString(e) || 'Errore nel caricamento.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tenantId])

  function copyMondayToAll() {
    const mon = rows.find(r => r.dow === 1)
    if (!mon) return

    setRows(prev =>
      prev.map(r => ({
        ...r,
        open_time_am: mon.open_time_am,
        close_time_am: mon.close_time_am,
        pm_enabled: mon.pm_enabled,
        open_time_pm: mon.open_time_pm,
        close_time_pm: mon.close_time_pm,
      })),
    )
    setSavedFlag(false)
  }

  function preset09_19() {
    setRows(prev =>
      prev.map(r => ({
        ...r,
        open_time_am: '09:00:00',
        close_time_am: '12:30:00',
        pm_enabled: true,
        open_time_pm: '15:00:00',
        close_time_pm: '19:00:00',
        is_closed: r.dow === 0,
      })),
    )
    setSavedFlag(false)
  }

  async function saveAll() {
    if (!tenantId) return

    setSaving(true)
    setError(null)

    try {
      const { error: stErr } = await supabase.from('tenant_settings').upsert(
        {
          tenant_id: tenantId,
          slot_minutes: settings.slot_minutes,
          lead_time_minutes: settings.lead_time_minutes,
          timezone: settings.timezone,
          service_staff_count: settings.service_staff_count,
          payment_mode_default: settings.payment_mode_default,
          staff_assign_mode: settings.staff_assign_mode,
          staff_selection_mode: settings.staff_selection_mode,
        },
        { onConflict: 'tenant_id' },
      )

      if (stErr) throw stErr

      const payload = rows.map(r => {
        const openTime = r.open_time_am || '09:00:00'
        const closeTime = (r.pm_enabled ? r.close_time_pm : r.close_time_am) || '19:00:00'

        return {
          tenant_id: tenantId,
          dow: r.dow,
          open_time_am: r.open_time_am || '09:00:00',
          close_time_am: r.close_time_am || '12:30:00',
          pm_enabled: !!r.pm_enabled,
          open_time_pm: r.open_time_pm || '15:00:00',
          close_time_pm: r.close_time_pm || '19:00:00',
          is_closed: !!r.is_closed,
          open_time: openTime,
          close_time: closeTime,
        }
      })

      const { error: hErr } = await supabase
        .from('tenant_hours')
        .upsert(payload, { onConflict: 'tenant_id,dow' })

      if (hErr) throw hErr

      setSavedFlag(true)
    } catch (e: any) {
      console.error('saveAll error raw:', e)
      setError(errToString(e) || 'Errore nel salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  const orderedRows = useMemo(() => {
    const m = new Map(rows.map(r => [r.dow, r]))
    return DOW_ORDER.map(d => m.get(d) || defaultRow(d))
  }, [rows])

  return (
    <main className="max-w-6xl mx-auto p-6 grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orari & capacità</h1>
          <p className="text-sm text-zinc-600">
            Configura slot, capacità e orari settimanali del salone.
          </p>
          <p className="text-xs text-zinc-500 mt-1">Tenant attivo</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-500">
            {saving ? 'Salvataggio…' : savedFlag ? 'Tutto salvato' : 'Modifiche non salvate'}
          </div>
          <button
            type="button"
            onClick={saveAll}
            disabled={saving || loading || !tenantId}
            className="px-4 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-50"
          >
            Salva modifiche
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-red-700 border rounded-xl p-3 bg-red-50">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Impostazioni prenotazioni" subtitle="Granularità e tempi minimi.">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Slot (min)">
              <input
                type="number"
                min={5}
                step={5}
                value={settings.slot_minutes}
                onChange={e => {
                  setSettings(s => ({ ...s, slot_minutes: Number(e.target.value || 10) }))
                  setSavedFlag(false)
                }}
                className="border rounded-xl px-3 py-2 w-full"
              />
            </Field>

            <Field label="Lead time (min)">
              <input
                type="number"
                min={0}
                step={5}
                value={settings.lead_time_minutes}
                onChange={e => {
                  setSettings(s => ({
                    ...s,
                    lead_time_minutes: Number(e.target.value || 20),
                  }))
                  setSavedFlag(false)
                }}
                className="border rounded-xl px-3 py-2 w-full"
              />
            </Field>

            <div className="col-span-2">
              <Field label="Timezone">
                <input
                  value={settings.timezone}
                  onChange={e => {
                    setSettings(s => ({ ...s, timezone: e.target.value }))
                    setSavedFlag(false)
                  }}
                  className="border rounded-xl px-3 py-2 w-full"
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card
          title="Capacità salone"
          subtitle="Quanti appuntamenti possono essere gestiti in parallelo."
        >
          <div className="grid gap-4">
            <Field
              label="Operatori contemporanei"
              hint={`Se imposti ${settings.service_staff_count}, lo stesso orario può accettare fino a ${settings.service_staff_count} prenotazioni.`}
            >
              <input
                type="number"
                min={1}
                value={settings.service_staff_count}
                onChange={e => {
                  setSettings(s => ({
                    ...s,
                    service_staff_count: Number(e.target.value || 1),
                  }))
                  setSavedFlag(false)
                }}
                className="border rounded-xl px-3 py-2 w-full"
              />
            </Field>

            <Field label="Pagamento servizi">
              <select
                value={settings.payment_mode_default}
                onChange={e => {
                  setSettings(s => ({
                    ...s,
                    payment_mode_default: e.target
                      .value as Settings['payment_mode_default'],
                  }))
                  setSavedFlag(false)
                }}
                className="border rounded-xl px-3 py-2 bg-white w-full"
              >
                <option value="online">Solo online (Stripe)</option>
                <option value="in_person">Solo in salone</option>
                <option value="client_choice">Cliente sceglie</option>
              </select>
            </Field>

            <Field
              label="Assegnazione operatore"
              hint="Serve quando il cliente sceglie 'Qualsiasi': primo libero (consigliato) oppure rotazione."
            >
              <select
                value={settings.staff_assign_mode}
                onChange={e => {
                  setSettings(s => ({
                    ...s,
                    staff_assign_mode: e.target
                      .value as Settings['staff_assign_mode'],
                  }))
                  setSavedFlag(false)
                }}
                className="border rounded-xl px-3 py-2 bg-white w-full"
              >
                <option value="first_free">Primo libero</option>
                <option value="round_robin">Round robin</option>
              </select>
            </Field>
            <Field
  label="Scelta operatore cliente"
  hint="Decidi se il cliente può scegliere un operatore specifico o se il sistema assegna automaticamente."
>
  <select
    value={settings.staff_selection_mode}
    onChange={e => {
      setSettings(s => ({
        ...s,
        staff_selection_mode: e.target
          .value as Settings['staff_selection_mode'],
      }))
      setSavedFlag(false)
    }}
    className="border rounded-xl px-3 py-2 bg-white w-full"
  >
    <option value="client_choice">Il cliente può scegliere</option>
    <option value="auto_only">Solo assegnazione automatica</option>
  </select>
</Field>
          </div>
        </Card>
      </div>

      <Card
        title="Orari settimanali"
        subtitle="Mattino + Pomeriggio"
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyMondayToAll}
              className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50"
              disabled={loading || !rows.length}
            >
              Copia Lun → tutti
            </button>
            <button
              type="button"
              onClick={preset09_19}
              className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50"
              disabled={loading || !rows.length}
            >
              Preset 09–19
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="text-sm text-zinc-500">Caricamento…</div>
        ) : (
          <div className="border rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[90px_1fr_1fr_90px] bg-zinc-50 border-b text-xs text-zinc-500">
              <div className="px-4 py-3 font-semibold text-zinc-700">Giorno</div>
              <div className="px-4 py-3 font-semibold text-zinc-700">Mattino</div>
              <div className="px-4 py-3 font-semibold text-zinc-700">Pomeriggio</div>
              <div className="px-4 py-3 font-semibold text-zinc-700 text-center">Chiuso</div>
            </div>

            {orderedRows.map(r => {
              const pause =
                !r.is_closed && r.pm_enabled
                  ? `${minutesToTime(timeToMinutes(toTime5(r.close_time_am)))} → ${minutesToTime(
                      timeToMinutes(toTime5(r.open_time_pm)),
                    )}`
                  : null

              return (
                <div
                  key={r.dow}
                  className="grid grid-cols-[90px_1fr_1fr_90px] border-b last:border-b-0 bg-white"
                >
                  <div className="px-4 py-4 font-semibold">{DOW_LABEL[r.dow]}</div>

                  <div className="px-4 py-3">
                    <div className="grid grid-rows-[auto_18px] gap-1">
                      <div className="flex items-end gap-4">
                        <Field label="Apre">
                          <input
                            type="time"
                            value={toTime5(r.open_time_am)}
                            disabled={r.is_closed}
                            onChange={e =>
                              updateRow(r.dow, { open_time_am: toTime8(e.target.value) })
                            }
                            className="border rounded-xl px-3 py-2 w-[120px]"
                          />
                        </Field>

                        <Field label="Chiude">
                          <input
                            type="time"
                            value={toTime5(r.close_time_am)}
                            disabled={r.is_closed}
                            onChange={e =>
                              updateRow(r.dow, { close_time_am: toTime8(e.target.value) })
                            }
                            className="border rounded-xl px-3 py-2 w-[120px]"
                          />
                        </Field>
                      </div>
                      <div className="h-[18px]" />
                    </div>
                  </div>

                  <div className="px-4 py-3">
                    <div className="grid grid-rows-[auto_18px] gap-1">
                      <div className="flex items-end gap-4">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={r.pm_enabled}
                            disabled={r.is_closed}
                            onChange={e =>
                              updateRow(r.dow, { pm_enabled: e.target.checked })
                            }
                          />
                          <span className="text-zinc-600">Attiva</span>
                        </label>

                        <Field label="Apre">
                          <input
                            type="time"
                            value={toTime5(r.open_time_pm)}
                            disabled={r.is_closed || !r.pm_enabled}
                            onChange={e =>
                              updateRow(r.dow, { open_time_pm: toTime8(e.target.value) })
                            }
                            className="border rounded-xl px-3 py-2 w-[120px]"
                          />
                        </Field>

                        <Field label="Chiude">
                          <input
                            type="time"
                            value={toTime5(r.close_time_pm)}
                            disabled={r.is_closed || !r.pm_enabled}
                            onChange={e =>
                              updateRow(r.dow, { close_time_pm: toTime8(e.target.value) })
                            }
                            className="border rounded-xl px-3 py-2 w-[120px]"
                          />
                        </Field>
                      </div>

                      <div className="text-[11px] text-zinc-500">
                        {pause ? <>Pausa: {pause}</> : null}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-4 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={r.is_closed}
                      onChange={e => updateRow(r.dow, { is_closed: e.target.checked })}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <BlockedSlotsPanel tenantId={tenantId} slotMinutes={settings.slot_minutes} />
    </main>
  )
}