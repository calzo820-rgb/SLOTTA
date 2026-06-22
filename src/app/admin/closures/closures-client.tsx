'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Staff = {
  id: string
  name: string
  is_active: boolean
  position: number
}

type Closure = {
  id: string
  tenant_id: string
  staff_id: string | null
  closure_type: 'salon' | 'staff'
  start_date: string
  end_date: string
  all_day: boolean
  start_time: string | null
  end_time: string | null
  created_at: string
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function ClosuresClient({ tenantId }: { tenantId: string }) {
  const [staff, setStaff] = useState<Staff[]>([])
  const [closures, setClosures] = useState<Closure[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [closureType, setClosureType] = useState<'salon' | 'staff'>('salon')
  const [staffId, setStaffId] = useState('')
  const [startDate, setStartDate] = useState(todayIso())
  const [endDate, setEndDate] = useState(todayIso())
const [allDay, setAllDay] = useState(true)
const [startTime, setStartTime] = useState('09:00')
const [endTime, setEndTime] = useState('13:00')
 

  const staffById = useMemo(() => {
    const map: Record<string, Staff> = {}
    staff.forEach(s => {
      map[s.id] = s
    })
    return map
  }, [staff])

  async function loadData() {
    if (!tenantId) return

    setLoading(true)
    setError(null)

    try {
      const { data: staffRows, error: staffErr } = await supabase
        .from('staff_members')
        .select('id, name, is_active, position')
        .eq('tenant_id', tenantId)
        .order('position', { ascending: true })
        .order('name', { ascending: true })

      if (staffErr) throw staffErr

      const { data: closureRows, error: closureErr } = await supabase
        .from('closures')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('start_date', { ascending: true })
        .order('created_at', { ascending: false })

      if (closureErr) throw closureErr

      setStaff((staffRows || []) as Staff[])
      setClosures((closureRows || []) as Closure[])
   } catch (e: unknown) {
  console.error(e)
  const message = e instanceof Error ? e.message : 'Errore nel caricamento.'
  setError(message)
} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tenantId])

  async function addClosure() {
    if (!tenantId) return

    if (closureType === 'staff' && !staffId) {
      setError('Seleziona un operatore.')
      return
    }

    if (!startDate || !endDate) {
      setError('Inserisci data inizio e data fine.')
      return
    }

    if (endDate < startDate) {
      setError('La data fine non può essere precedente alla data inizio.')
      return
    }
    if (!allDay && endTime <= startTime) {
  setError('L’orario di fine deve essere successivo all’orario di inizio.')
  return
}
    setSaving(true)
    setError(null)

    try {
const payload = {
  tenant_id: tenantId,
  closure_type: closureType,
  staff_id: closureType === 'staff' ? staffId : null,
  start_date: startDate,
  end_date: endDate,
  all_day: allDay,
  start_time: allDay ? null : `${startTime}:00`,
  end_time: allDay ? null : `${endTime}:00`,
}

      const { error } = await supabase.from('closures').insert(payload)

      if (error) throw error
      await loadData()
} catch (e: unknown) {
  console.error(e)
  const message = e instanceof Error ? e.message : 'Errore nel salvataggio.'
  setError(message)
} finally {
      setSaving(false)
    }
  }

  async function deleteClosure(id: string) {
    const ok = window.confirm('Vuoi eliminare questa chiusura?')
    if (!ok) return

    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase.from('closures').delete().eq('id', id)

      if (error) throw error

      setClosures(prev => prev.filter(c => c.id !== id))
} catch (e: unknown) {
  console.error(e)
  const message = e instanceof Error ? e.message : 'Errore eliminazione.'
  setError(message)
} finally {
      setSaving(false)
    }
  }
const today = new Date().toISOString().slice(0, 10)

const visibleClosures = closures
  .filter(c => c.end_date >= today)
  .sort((a, b) => a.start_date.localeCompare(b.start_date))
  return (
  <main className="min-h-screen bg-[#F2F4F7] px-4 py-5 text-[#0F1D2D] md:px-6">
    <div className="mx-auto grid max-w-7xl gap-5">
      {/* HEADER */}
      <header className="flex flex-col gap-2">
        <div>
  <p className="hidden md:block text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
    Area gestore
  </p>

  <h1 className="hidden md:block text-3xl font-black tracking-tight text-[#0F1D2D]">
    Ferie / chiusure
  </h1>

  <p className="text-sm text-slate-600 md:mt-1">
    Gestisci chiusure dell’attività e assenze dei singoli operatori.
  </p>
</div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {/* NUOVA CHIUSURA */}
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-[#F8FAFC] px-5 py-4">
          <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
            Nuova chiusura
          </p>

          <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
            Blocca un periodo
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Scegli se bloccare tutto il salone oppure solo un operatore.
          </p>
        </div>

        <div className="grid gap-5 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm font-bold text-[#0F1D2D]">Tipo</span>

              <select
                value={closureType}
                onChange={e => setClosureType(e.target.value as 'salon' | 'staff')}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
              >
                <option value="salon">Chiusura salone</option>
                <option value="staff">Assenza operatore</option>
              </select>
            </label>

            {closureType === 'staff' ? (
              <label className="grid gap-1">
                <span className="text-sm font-bold text-[#0F1D2D]">Operatore</span>

                <select
                  value={staffId}
                  onChange={e => setStaffId(e.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                >
                  <option value="">Seleziona operatore</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-[#F8FAFC] p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Impatto
                </p>
                <p className="mt-1 text-sm font-bold text-[#0F1D2D]">
                  Tutti gli operatori e tutti gli slot saranno bloccati.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm font-bold text-[#0F1D2D]">Da</span>

              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value)
                  if (endDate < e.target.value) setEndDate(e.target.value)
                }}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-bold text-[#0F1D2D]">A</span>

              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
              />
            </label>
          </div>
<div className="grid gap-4 md:grid-cols-2 md:items-start">
  <div className="grid gap-1">
    <label className="text-sm font-bold text-[#0F1D2D]">
      Durata chiusura
    </label>

    <select
      value={allDay ? 'all_day' : 'time_range'}
      onChange={e => setAllDay(e.target.value === 'all_day')}
      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
    >
      <option value="all_day">Tutto il giorno</option>
      <option value="time_range">Solo una fascia oraria</option>
    </select>

    <span className="text-xs text-slate-500">
      Usa “fascia oraria” per bloccare solo alcune ore.
    </span>
  </div>

  <div className="grid gap-1">
    <label className="text-sm font-bold text-[#0F1D2D]">
      Fascia oraria
    </label>

    {!allDay ? (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <input
          type="time"
          value={startTime}
          onChange={e => setStartTime(e.target.value)}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
        />

        <span className="text-sm font-black text-slate-400">→</span>

        <input
          type="time"
          value={endTime}
          onChange={e => setEndTime(e.target.value)}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
        />
      </div>
    ) : (
      <div className="flex h-11 items-center rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 text-sm font-bold text-[#0F1D2D]">
        Tutto il giorno
      </div>
    )}

    <span className="text-xs text-slate-500">
      {allDay
        ? 'Verrà bloccata tutta la giornata.'
        : 'Gli slot dentro questa fascia non saranno prenotabili.'}
    </span>
  </div>
</div>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving || loading}
              onClick={addClosure}
              className="w-full rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:-translate-y-[1px] hover:brightness-95 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            >
              {saving ? 'Salvataggio…' : 'Aggiungi chiusura'}
            </button>
          </div>
        </div>
      </section>

      {/* CHIUSURE INSERITE */}
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-[#F8FAFC] px-5 py-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
              Calendario chiusure
            </p>

            <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
              Chiusure inserite
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Chiusure salone e assenze operatori future o ancora attive.
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#1FA7A6] shadow-sm">
            {visibleClosures.length} attive
          </span>
        </div>

        {loading ? (
          <div className="p-5 text-sm text-slate-500">Caricamento…</div>
        ) : visibleClosures.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            Nessuna chiusura inserita.
          </div>
        ) : (
          <div className="grid gap-3 p-4">
            {visibleClosures.map(c => {
              const isSalon = c.closure_type === 'salon'
              const staffName = c.staff_id ? staffById[c.staff_id]?.name : null

              return (
                <div
                  key={c.id}
                  className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                >
                  <div className="grid gap-4 md:grid-cols-[1fr_220px_140px_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            'inline-flex rounded-full border px-3 py-1 text-xs font-black',
                            isSalon
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700',
                          ].join(' ')}
                        >
                          {isSalon ? 'Salone' : 'Operatore'}
                        </span>

                        <div className="truncate text-base font-black text-[#0F1D2D]">
                          {isSalon
                            ? 'Salone chiuso'
                            : `${staffName || 'Operatore'} assente`}
                        </div>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        Questa chiusura blocca le prenotazioni nel periodo selezionato.
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                        Periodo
                      </p>

                      <p className="mt-1 text-sm font-black text-[#0F1D2D]">
                        {fmtDate(c.start_date)}
                        {c.end_date !== c.start_date ? ` → ${fmtDate(c.end_date)}` : ''}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                        Orario
                      </p>

                    <p className="mt-1 text-sm font-bold text-slate-600">
  {c.all_day
    ? 'Tutto il giorno'
    : `${(c.start_time || '').slice(0, 5)} → ${(c.end_time || '').slice(0, 5)}`}
</p>
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => deleteClosure(c.id)}
                      className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50 md:justify-self-end"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  </main>
)
}