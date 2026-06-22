'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { HoursRow, Settings, MobileSections } from './types'
import { DOW_LABEL, DOW_ORDER } from './constants'
import {
  toTime5,
  toTime8,
  errToString,
} from './utils'
import { Field } from './components/Field'
import { Card } from './components/Card'
// import BlockedSlotsPanel from './blocked-slots-panel'
type TenantSettingsRow = {
  slot_minutes?: number | string | null
  lead_minutes?: number | string | null
  timezone?: string | null
  service_staff_count?: number | string | null
  payment_mode_default?: Settings['payment_mode_default'] | null
  staff_assign_mode?: Settings['staff_assign_mode'] | null
  staff_selection_mode?: Settings['staff_selection_mode'] | null
}

type LegacyTenantHoursRow = {
  dow: number
  open_time?: string | null
  close_time?: string | null
  is_closed?: boolean | null
}
export default function HoursClient({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<HoursRow[]>([])
  const [settings, setSettings] = useState<Settings>({
  slot_minutes: '30',
  lead_minutes: '30',
  timezone: 'Europe/Rome',
  service_staff_count: '1',
  payment_mode_default: 'in_person',
  staff_assign_mode: 'first_free',
  staff_selection_mode: 'client_choice',
})
const [openMobileDay, setOpenMobileDay] = useState<number | null>(1)

const [mobileSections, setMobileSections] = useState<MobileSections>({
  rules: false,
  weeklyHours: false,
})
function toggleMobileSection(section: keyof typeof mobileSections) {
  setMobileSections(prev => ({
    ...prev,
    [section]: !prev[section],
  }))
}
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
        let stRow: TenantSettingsRow | null = null

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
          stRow = st2 as TenantSettingsRow
        } else {
          stRow = st as TenantSettingsRow
        }

        if (!cancelled) {
          setSettings({
  slot_minutes: String(stRow?.slot_minutes ?? 30),
  lead_minutes: String(stRow?.lead_minutes ?? 30),
  timezone: stRow?.timezone || 'Europe/Rome',
  service_staff_count: String(stRow?.service_staff_count ?? 1),
  payment_mode_default: (stRow?.payment_mode_default ||
    'in_person') as Settings['payment_mode_default'],
  staff_assign_mode: (stRow?.staff_assign_mode ||
    'first_free') as Settings['staff_assign_mode'],
  staff_selection_mode: (stRow?.staff_selection_mode ||
    'client_choice') as Settings['staff_selection_mode'],
})
        }

        let hh: HoursRow[] = []

        const { data: hhNew, error: hErrNew } = await supabase
          .from('tenant_hours')
          .select(
            'dow, open_time_am, close_time_am, pm_enabled, open_time_pm, close_time_pm, is_closed',
          )
          .eq('tenant_id', tenantId)

        if (!hErrNew) {
          hh = (hhNew || []) as HoursRow[]
        } else {
          const { data: hhOld, error: hErrOld } = await supabase
            .from('tenant_hours')
            .select('dow, open_time, close_time, is_closed')
            .eq('tenant_id', tenantId)

          if (hErrOld) throw hErrOld

          hh = ((hhOld || []) as LegacyTenantHoursRow[]).map(r => ({
            dow: r.dow,
            open_time_am: r.open_time || '09:00:00',
            close_time_am: r.close_time || '19:00:00',
            pm_enabled: false,
            open_time_pm: '15:00:00',
            close_time_pm: '19:00:00',
            is_closed: r.is_closed ?? false,
          }))
        }

       const map = new Map<number, HoursRow>()
hh.forEach(r => map.set(r.dow, r))

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
      } catch (e: unknown) {
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

 async function saveAll() {
  if (!tenantId) return

  const slotMinutesValue = Number(settings.slot_minutes)
  const leadTimeValue = Number(settings.lead_minutes)
  const staffCountValue = Number(settings.service_staff_count)

  if (
    !settings.slot_minutes.trim() ||
    !Number.isFinite(slotMinutesValue) ||
    slotMinutesValue <= 0
  ) {
    setError('Seleziona un intervallo valido tra gli orari disponibili.')
    return
  }

  if (
    !settings.lead_minutes.trim() ||
    !Number.isFinite(leadTimeValue) ||
    leadTimeValue < 0
  ) {
    setError('Seleziona quanto prima può prenotare il cliente.')
    return
  }

  if (
    !settings.service_staff_count.trim() ||
    !Number.isFinite(staffCountValue) ||
    staffCountValue <= 0
  ) {
    setError('Inserisci un numero valido di appuntamenti contemporanei.')
    return
  }

  setSaving(true)
  setError(null)

  try {
      const { error: stErr } = await supabase.from('tenant_settings').upsert(
        {
          tenant_id: tenantId,
          slot_minutes: slotMinutesValue,
lead_minutes: leadTimeValue,
timezone: settings.timezone,
service_staff_count: staffCountValue,
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
   } catch (e: unknown) {
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
const slotMinutesValue = Number(settings.slot_minutes)
const leadTimeValue = Number(settings.lead_minutes)
const staffCountValue = Number(settings.service_staff_count)

const settingsInvalid =
  !settings.slot_minutes.trim() ||
  !Number.isFinite(slotMinutesValue) ||
  slotMinutesValue <= 0 ||
  !settings.lead_minutes.trim() ||
  !Number.isFinite(leadTimeValue) ||
  leadTimeValue < 0 ||
  !settings.service_staff_count.trim() ||
  !Number.isFinite(staffCountValue) ||
  staffCountValue <= 0
  return (
  <main className="min-h-screen bg-[#F2F4F7] px-4 py-5 pb-24 text-[#0F1D2D] md:px-6 md:pb-8">
    <div className="mx-auto grid max-w-7xl gap-5">
      {/* HEADER PAGINA */}
<div className="flex flex-wrap items-start justify-between gap-4">
  <div>
    <p className="hidden md:block text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
      Area gestore
    </p>

    <h1 className="hidden md:block text-3xl font-black tracking-tight text-[#0F1D2D]">
      Orari & capacità
    </h1>

    <p className="text-sm text-slate-600 md:mt-1">
      Configura quando i clienti possono prenotare e quante prenotazioni puoi gestire.
    </p>
  </div>
        <div className="hidden items-center gap-3 md:flex">
          <div
            className={[
              'rounded-full px-3 py-1.5 text-xs font-black',
              saving
                ? 'bg-amber-50 text-amber-700'
                : savedFlag
                ? 'bg-[#E6FFFA] text-[#0F766E]'
                : 'bg-amber-50 text-amber-700',
            ].join(' ')}
          >
            {saving ? 'Salvataggio…' : savedFlag ? 'Tutto salvato' : 'Modifiche non salvate'}
          </div>

          <button
  type="button"
  onClick={saveAll}
  disabled={saving || loading || !tenantId || settingsInvalid}
            className="rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:-translate-y-[1px] hover:brightness-95 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}
<Card
  title="Regole di prenotazione"
  subtitle="Decidi ogni quanto mostrare gli orari, quanto prima si può prenotare e come assegnare gli operatori."
  right={
    <button
      type="button"
      onClick={() => toggleMobileSection('rules')}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6] md:hidden"
    >
      {mobileSections.rules ? '▲' : '▼'}
    </button>
  }
>
  <div className={mobileSections.rules ? 'grid gap-4 p-5' : 'hidden gap-4 p-5 md:grid'}>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <Field
    label="Intervallo tra gli orari disponibili"
    hint="Esempio: con 30 minuti il cliente vedrà orari come 09:00, 09:30, 10:00."
  >
    <select
      value={settings.slot_minutes}
      onChange={e => {
        setSettings(s => ({
          ...s,
          slot_minutes: e.target.value,
        }))
        setSavedFlag(false)
      }}
      className={[
        'h-11 rounded-2xl border bg-white px-4 text-sm outline-none transition focus:ring-2',
        !settings.slot_minutes.trim() || Number(settings.slot_minutes) <= 0
          ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'
          : 'border-slate-200 focus:border-[#1FA7A6] focus:ring-[#1FA7A6]/10',
      ].join(' ')}
    >
      <option value="10">Ogni 10 minuti</option>
      <option value="15">Ogni 15 minuti</option>
      <option value="20">Ogni 20 minuti</option>
      <option value="30">Ogni 30 minuti</option>
      <option value="60">Ogni 60 minuti</option>
    </select>
  </Field>

  <Field
    label="Quanto prima può prenotare il cliente"
    hint="Evita prenotazioni troppo ravvicinate. Esempio: 30 minuti prima."
  >
    <select
      value={settings.lead_minutes}
      onChange={e => {
        setSettings(s => ({
          ...s,
          lead_minutes: e.target.value,
        }))
        setSavedFlag(false)
      }}
      className={[
        'h-11 rounded-2xl border bg-white px-4 text-sm outline-none transition focus:ring-2',
        !settings.lead_minutes.trim() || Number(settings.lead_minutes) < 0
          ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'
          : 'border-slate-200 focus:border-[#1FA7A6] focus:ring-[#1FA7A6]/10',
      ].join(' ')}
    >
      <option value="0">Anche subito</option>
      <option value="15">Almeno 15 minuti prima</option>
      <option value="30">Almeno 30 minuti prima</option>
      <option value="60">Almeno 1 ora prima</option>
      <option value="120">Almeno 2 ore prima</option>
      <option value="240">Almeno 4 ore prima</option>
      <option value="1440">Almeno 1 giorno prima</option>
    </select>
  </Field>

  <Field
    label="Appuntamenti contemporanei massimi"
    hint="Quanti clienti puoi gestire nello stesso orario. Di solito coincide con il numero di operatori disponibili."
  >
    <input
      type="number"
      min={1}
      value={settings.service_staff_count}
      onChange={e => {
        setSettings(s => ({
          ...s,
          service_staff_count: e.target.value,
        }))
        setSavedFlag(false)
      }}
      className={[
        'h-11 rounded-2xl border px-4 text-sm outline-none transition focus:ring-2',
        !settings.service_staff_count.trim() || Number(settings.service_staff_count) <= 0
          ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'
          : 'border-slate-200 focus:border-[#1FA7A6] focus:ring-[#1FA7A6]/10',
      ].join(' ')}
      placeholder="Es. 1"
    />
  </Field>

  <Field
    label="Metodo di pagamento"
    hint="Per iniziare, consigliato: pagamento in salone."
  >
    <select
      value={settings.payment_mode_default}
      onChange={e => {
        setSettings(s => ({
          ...s,
          payment_mode_default: e.target.value as Settings['payment_mode_default'],
        }))
        setSavedFlag(false)
      }}
      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
    >
      <option value="in_person">Pagamento in salone</option>
      <option value="online">Pagamento online</option>
      <option value="client_choice">Il cliente può scegliere</option>
    </select>
  </Field>

  <Field
    label="Come assegnare l’operatore"
    hint="Scegli come Slotta assegna automaticamente un operatore quando il cliente non ne seleziona uno."
  >
    <select
      value={settings.staff_assign_mode}
      onChange={e => {
        setSettings(s => ({
          ...s,
          staff_assign_mode: e.target.value as Settings['staff_assign_mode'],
        }))
        setSavedFlag(false)
      }}
      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
    >
      <option value="first_free">Primo operatore libero</option>
      <option value="round_robin">Distribuisci tra gli operatori</option>
    </select>
  </Field>

  <Field
    label="Scelta operatore dal cliente"
    hint="Puoi mostrare la scelta dell’operatore nella pagina cliente oppure nasconderla."
  >
    <select
      value={settings.staff_selection_mode}
      onChange={e => {
        setSettings(s => ({
          ...s,
          staff_selection_mode: e.target.value as Settings['staff_selection_mode'],
        }))
        setSavedFlag(false)
      }}
      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
    >
      <option value="auto_only">Nascondi scelta operatore</option>
      <option value="client_choice">Il cliente può scegliere</option>
    </select>
  </Field>
</div>
  </div>
</Card>
     <Card
  title="Orari settimanali"
  subtitle="Imposta mattina, pomeriggio, mezze giornate e giorni di chiusura."
  right={
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={copyMondayToAll}
        className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6] md:inline-flex"
        disabled={loading || !rows.length}
      >
        Copia Lun → tutti
      </button>

      <button
        type="button"
        onClick={() => toggleMobileSection('weeklyHours')}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6] md:hidden"
      >
        {mobileSections.weeklyHours ? '▲' : '▼'}
      </button>
    </div>
  }
>
  <div className={mobileSections.weeklyHours ? 'block' : 'hidden md:block'}>
    <div className="p-5">
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 text-sm text-slate-500">
          Caricamento…
        </div>
      ) : (
        <>
          {/* bottone mobile dentro il contenuto */}
          <div className="mb-4 md:hidden">
            <button
              type="button"
              onClick={copyMondayToAll}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
              disabled={loading || !rows.length}
            >
              Copia orari del lunedì su tutti i giorni
            </button>
          </div>

          {/* MOBILE */}
          <div className="grid gap-3 md:hidden">
            {orderedRows.map(r => {
              const halfDay = !r.pm_enabled
              const isOpen = openMobileDay === r.dow

              return (
                <div
                  key={r.dow}
                  className={[
                    'overflow-hidden rounded-3xl border shadow-sm',
                    r.is_closed
                      ? 'border-slate-200 bg-slate-50 text-slate-400'
                      : 'border-slate-200 bg-white text-[#0F1D2D]',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => setOpenMobileDay(isOpen ? null : r.dow)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F2F4F7] text-sm font-black">
                        {DOW_LABEL[r.dow]}
                      </span>

                      {r.is_closed ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                          Chiuso
                        </span>
                      ) : halfDay ? (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                          Mezza giornata
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#E6FFFA] px-3 py-1 text-xs font-black text-[#0F766E]">
                          Aperto
                        </span>
                      )}
                    </div>

                    <span className="text-sm font-black text-slate-400">
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="grid gap-4 border-t border-slate-100 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-5 text-sm">
                        <label className="flex items-center gap-2 font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={halfDay}
                            disabled={r.is_closed}
                            onChange={e =>
                              updateRow(r.dow, { pm_enabled: !e.target.checked })
                            }
                          />
                          Mezza giornata
                        </label>

                        <label className="flex items-center gap-2 font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={r.is_closed}
                            onChange={e => updateRow(r.dow, { is_closed: e.target.checked })}
                          />
                          Chiuso
                        </label>
                      </div>

                      {!r.is_closed && (
                        <div className="grid gap-3 text-sm">
                          <div className="grid gap-2">
                            <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                              {halfDay ? 'Orario' : 'Mattino'}
                            </div>

                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                              <input
                                type="time"
                                value={toTime5(r.open_time_am)}
                                onChange={e =>
                                  updateRow(r.dow, { open_time_am: toTime8(e.target.value) })
                                }
                                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1FA7A6]"
                              />

                              <span className="text-slate-400">→</span>

                              <input
                                type="time"
                                value={toTime5(r.close_time_am)}
                                onChange={e =>
                                  updateRow(r.dow, { close_time_am: toTime8(e.target.value) })
                                }
                                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1FA7A6]"
                              />
                            </div>
                          </div>

                          {!halfDay && (
                            <div className="grid gap-2">
                              <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                                Pomeriggio
                              </div>

                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <input
                                  type="time"
                                  value={toTime5(r.open_time_pm)}
                                  onChange={e =>
                                    updateRow(r.dow, { open_time_pm: toTime8(e.target.value) })
                                  }
                                  className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1FA7A6]"
                                />

                                <span className="text-slate-400">→</span>

                                <input
                                  type="time"
                                  value={toTime5(r.close_time_pm)}
                                  onChange={e =>
                                    updateRow(r.dow, { close_time_pm: toTime8(e.target.value) })
                                  }
                                  className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1FA7A6]"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* DESKTOP */}
          <div className="hidden md:block">
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
              <div className="grid grid-cols-[90px_1fr_1fr_150px_110px] border-b border-slate-100 bg-[#F8FAFC] text-xs font-black uppercase tracking-wide text-slate-400">
                <div className="px-4 py-4">Giorno</div>
                <div className="px-4 py-4">Mattino</div>
                <div className="px-4 py-4">Pomeriggio</div>
                <div className="px-4 py-4 text-center">Mezza giornata</div>
                <div className="px-4 py-4 text-center">Chiuso</div>
              </div>

              {orderedRows.map(r => {
                const halfDay = !r.pm_enabled

                return (
                  <div
                    key={r.dow}
                    className={[
                      'grid grid-cols-[90px_1fr_1fr_150px_110px] items-center border-b border-slate-100 last:border-b-0',
                      r.is_closed ? 'bg-slate-50 text-slate-400' : 'bg-white',
                    ].join(' ')}
                  >
                    <div className="px-4 py-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F2F4F7] text-sm font-black text-[#0F1D2D]">
                        {DOW_LABEL[r.dow]}
                      </div>
                    </div>

                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={toTime5(r.open_time_am)}
                          disabled={r.is_closed}
                          onChange={e =>
                            updateRow(r.dow, { open_time_am: toTime8(e.target.value) })
                          }
                          className="h-11 w-[120px] rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1FA7A6] disabled:bg-slate-100"
                        />

                        <span className="text-slate-400">→</span>

                        <input
                          type="time"
                          value={toTime5(r.close_time_am)}
                          disabled={r.is_closed}
                          onChange={e =>
                            updateRow(r.dow, { close_time_am: toTime8(e.target.value) })
                          }
                          className="h-11 w-[120px] rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1FA7A6] disabled:bg-slate-100"
                        />
                      </div>
                    </div>

                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={toTime5(r.open_time_pm)}
                          disabled={r.is_closed || halfDay}
                          onChange={e =>
                            updateRow(r.dow, { open_time_pm: toTime8(e.target.value) })
                          }
                          className="h-11 w-[120px] rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1FA7A6] disabled:bg-slate-100"
                        />

                        <span className="text-slate-400">→</span>

                        <input
                          type="time"
                          value={toTime5(r.close_time_pm)}
                          disabled={r.is_closed || halfDay}
                          onChange={e =>
                            updateRow(r.dow, { close_time_pm: toTime8(e.target.value) })
                          }
                          className="h-11 w-[120px] rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1FA7A6] disabled:bg-slate-100"
                        />
                      </div>
                    </div>

                    <div className="flex justify-center px-4 py-4">
                      <input
                        type="checkbox"
                        checked={halfDay}
                        disabled={r.is_closed}
                        onChange={e =>
                          updateRow(r.dow, { pm_enabled: !e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                    </div>

                    <div className="flex justify-center px-4 py-4">
                      <input
                        type="checkbox"
                        checked={r.is_closed}
                        onChange={e => updateRow(r.dow, { is_closed: e.target.checked })}
                        className="h-4 w-4"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  </div>
</Card>
     {!savedFlag && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white p-3 shadow-[0_-10px_30px_rgba(15,29,45,0.08)] md:hidden">
          <button
            type="button"
            onClick={saveAll}
            disabled={saving || loading || !tenantId || settingsInvalid}
            className="w-full rounded-2xl bg-[#FFC145] px-4 py-3 text-sm font-black text-[#0F1D2D] shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      )}
    </div>
  </main>
)
}