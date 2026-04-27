'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Staff = {
  id: string
  tenant_id: string
  name: string
  is_active: boolean
  position: number
}
const STAFF_DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]
const STAFF_DOW_LABEL: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Gio',
  5: 'Ven',
  6: 'Sab',
  0: 'Dom',
}
export default function StaffClient({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<Staff[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoursOpen, setHoursOpen] = useState(false)
const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
const [staffHours, setStaffHours] = useState<any[]>([])
const orderedStaffHours = useMemo(() => {
  const map = new Map(staffHours.map(r => [r.dow, r]))
  return STAFF_DOW_ORDER.map(dow => map.get(dow)).filter(Boolean)
}, [staffHours])
async function openHours(staff: Staff) {
  setSelectedStaff(staff)
  setHoursOpen(true)

  const { data, error } = await supabase
    .from('staff_hours')
    .select('*')
    .eq('staff_id', staff.id)

  if (error) {
    setError(error.message)
    return
  }

  setStaffHours(data || [])
}

function updateHour(dow: number, patch: any) {
  setStaffHours(prev =>
    prev.map(r => (r.dow === dow ? { ...r, ...patch } : r))
  )
}

async function saveHours() {
  if (!selectedStaff) return

  const payload = staffHours.map(r => ({
    ...r,
    staff_id: selectedStaff.id,
    tenant_id: tenantId,
  }))

  const { error } = await supabase
    .from('staff_hours')
    .upsert(payload, { onConflict: 'staff_id,dow' })

  if (error) {
    setError(error.message)
    return
  }

  setHoursOpen(false)
}
  async function loadStaff() {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('staff_members')
        .select('id, tenant_id, name, is_active, position')
        .eq('tenant_id', tenantId)
        .order('position', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      setRows((data || []) as Staff[])
    } catch (e: any) {
      setError(e?.message || 'Errore caricamento staff.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStaff()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  const nextPosition = useMemo(() => {
    if (!rows.length) return 0
    return Math.max(...rows.map(r => r.position ?? 0)) + 1
  }, [rows])

  async function addStaff() {
    if (!tenantId) return
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError('Inserisci un nome valido (min 2 caratteri).')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase.from('staff_members').insert({
        tenant_id: tenantId,
        name: trimmed,
        is_active: true,
        position: nextPosition,
      })
      if (error) throw error

      setName('')
      await loadStaff()
    } catch (e: any) {
      setError(e?.message || 'Errore inserimento.')
    } finally {
      setSaving(false)
    }
  }

  async function updateStaff(id: string, patch: Partial<Staff>) {
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase.from('staff_members').update(patch).eq('id', id)
      if (error) throw error

      setRows(prev => prev.map(r => (r.id === id ? ({ ...r, ...patch } as Staff) : r)))
    } catch (e: any) {
      setError(e?.message || 'Errore aggiornamento.')
    } finally {
      setSaving(false)
    }
  }

  async function removeStaff(id: string) {
    if (!confirm('Eliminare questo operatore?')) return
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase.from('staff_members').delete().eq('id', id)
      if (error) throw error

      setRows(prev => prev.filter(r => r.id !== id))
    } catch (e: any) {
      setError(e?.message || 'Errore eliminazione.')
    } finally {
      setSaving(false)
    }
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = rows.findIndex(r => r.id === id)
    const otherIdx = idx + dir
    if (idx < 0 || otherIdx < 0 || otherIdx >= rows.length) return

    const a = rows[idx]
    const b = rows[otherIdx]

    // swap posizione (2 update)
    setSaving(true)
    setError(null)
    try {
      const { error: e1 } = await supabase
        .from('staff_members')
        .update({ position: b.position })
        .eq('id', a.id)
      if (e1) throw e1

      const { error: e2 } = await supabase
        .from('staff_members')
        .update({ position: a.position })
        .eq('id', b.id)
      if (e2) throw e2

      setRows(prev =>
        [...prev]
          .map(r => (r.id === a.id ? { ...r, position: b.position } : r))
          .map(r => (r.id === b.id ? { ...r, position: a.position } : r))
          .sort((x, y) => (x.position ?? 0) - (y.position ?? 0)),
      )
    } catch (e: any) {
      setError(e?.message || 'Errore riordino.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6 grid gap-4">
      <header>
        <h1 className="text-2xl font-bold">Staff</h1>
        <div className="text-sm text-zinc-600">
          Aggiungi e gestisci gli operatori. (Disponibilità per operatore la facciamo nel prossimo step.)
        </div>
      </header>

      {error ? (
        <div className="text-sm text-red-700 border rounded-xl p-3 bg-red-50">{error}</div>
      ) : null}

      <section className="border rounded-2xl bg-white shadow-sm p-4 grid gap-3">
        <div className="font-semibold">Aggiungi operatore</div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome (es. Marco)"
            className="border rounded-xl px-3 py-2 w-full"
          />
          <button
            type="button"
            onClick={addStaff}
            disabled={saving || !tenantId}
            className="px-4 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-50"
          >
            Aggiungi
          </button>
        </div>
      </section>

      <section className="border rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold">Operatori</div>

        {loading ? (
          <div className="p-4 text-sm text-zinc-500">Caricamento…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">Nessun operatore.</div>
        ) : (
          <div className="divide-y">
            {rows.map((r, i) => (
              <div key={r.id} className="p-4 flex items-center gap-3">
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <input
                      value={r.name}
                      onChange={e => updateStaff(r.id, { name: e.target.value })}
                      className="border rounded-xl px-3 py-2 w-full"
                    />
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={r.is_active}
                        onChange={e => updateStaff(r.id, { is_active: e.target.checked })}
                      />
                      <span className="text-zinc-600">Attivo</span>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-zinc-500">Ordine: {r.position}</div>

                   <div className="flex items-center gap-4">
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => move(r.id, -1)}
      disabled={saving || i === 0}
      className="px-3 py-2 rounded-xl border text-sm disabled:opacity-40"
    >
      ↑
    </button>
    <button
      type="button"
      onClick={() => move(r.id, 1)}
      disabled={saving || i === rows.length - 1}
      className="px-3 py-2 rounded-xl border text-sm disabled:opacity-40"
    >
      ↓
    </button>
  </div>

  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={() => openHours(r)}
      className="px-4 py-2 rounded-xl border text-sm hover:bg-zinc-50"
    >
      Orari
    </button>

    <button
      type="button"
      onClick={() => removeStaff(r.id)}
      disabled={saving}
      className="px-4 py-2 rounded-xl border text-sm hover:bg-red-50"
      style={{ borderColor: '#fecaca', color: '#b91c1c' }}
    >
      Elimina
    </button>
  </div>
</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {hoursOpen && selectedStaff && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-6 w-full max-w-2xl">
      <h2 className="text-lg font-semibold mb-4">
        Orari - {selectedStaff.name}
      </h2>

      <div className="grid gap-3">
        {orderedStaffHours.map(r => (
        <div key={r.dow} className="flex items-center gap-3 border rounded-xl p-3">
  <div className="w-16 text-sm font-medium">
    {STAFF_DOW_LABEL[r.dow]}
  </div>

  {/* Mattina */}
  <input
    type="time"
    value={r.open_time_am?.slice(0,5) || ''}
    onChange={e => updateHour(r.dow, { open_time_am: e.target.value || null })}
    className="border rounded px-2 py-1"
    disabled={r.is_closed}
  />

  <span>-</span>

  <input
    type="time"
    value={r.close_time_am?.slice(0,5) || ''}
    onChange={e => updateHour(r.dow, { close_time_am: e.target.value || null })}
    className="border rounded px-2 py-1"
    disabled={r.is_closed}
  />

  {/* Pomeriggio */}
  <input
    type="time"
    value={r.open_time_pm?.slice(0,5) || ''}
    onChange={e => updateHour(r.dow, { open_time_pm: e.target.value || null })}
    className="border rounded px-2 py-1 ml-4"
    disabled={r.is_closed}
  />

  <span>-</span>

  <input
    type="time"
    value={r.close_time_pm?.slice(0,5) || ''}
    onChange={e => updateHour(r.dow, { close_time_pm: e.target.value || null })}
    className="border rounded px-2 py-1"
    disabled={r.is_closed}
  />

  {/* Chiuso */}
  <label className="text-xs flex items-center gap-1 ml-auto">
    <input
      type="checkbox"
      checked={r.is_closed}
      onChange={e =>
        updateHour(r.dow, {
          is_closed: e.target.checked,
          ...(e.target.checked
            ? {
                open_time_am: null,
                close_time_am: null,
                open_time_pm: null,
                close_time_pm: null,
              }
            : {}),
        })
      }
    />
    Chiuso
  </label>
</div>
        ))}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={() => setHoursOpen(false)}
          className="px-4 py-2 border rounded-xl"
        >
          Annulla
        </button>
        <button
          onClick={saveHours}
          className="px-4 py-2 bg-black text-white rounded-xl"
        >
          Salva
        </button>
      </div>
    </div>
  </div>
)}
    </main>
  )
}
