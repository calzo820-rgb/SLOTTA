'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Staff, StaffAccess, MobileSections } from './types'
import type { StaffHoursRow } from '@/components/service-booking/types'
import {
  STAFF_DOW_LABEL,
  STAFF_DOW_ORDER,
} from './constants'
import { MobileSectionHeader } from './components/MobileSectionHeader'
import { StaffAccessPanel } from './components/StaffAccessPanel'

// Types for API responses used in this module. These reflect the shape of JSON returned
// by our custom API endpoints when creating or deleting staff access codes. Defining these
// here avoids the use of `any` when parsing JSON.
type StaffAccessApiResponse = {
  error?: string
  step?: string
  code?: string
  details?: string
  hint?: string
  staff_login_code?: string
}

export default function StaffClient({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<Staff[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staffAccesses, setStaffAccesses] = useState<StaffAccess[]>([])
const [loadingAccesses, setLoadingAccesses] = useState(false)
const [staffLoginCode, setStaffLoginCode] = useState<string | null>(null)
const [mobileSections, setMobileSections] = useState<MobileSections>({
  addStaff: false,
  operators: false,
  accesses: false,
})
async function loadStaffLoginCode() {
  if (!tenantId) return

  const { data, error } = await supabase
    .from('tenants')
    .select('staff_login_code')
    .eq('id', tenantId)
    .maybeSingle()

  if (error) {
    setError(error.message)
    return
  }

  setStaffLoginCode(data?.staff_login_code || null)
}
function toggleMobileSection(section: keyof typeof mobileSections) {
  setMobileSections(prev => ({
    ...prev,
    [section]: !prev[section],
  }))
}
const [accessUsername, setAccessUsername] = useState('')
const [accessPassword, setAccessPassword] = useState('')
const [allowedPages, setAllowedPages] = useState<string[]>(['bookings', 'calendar'])
const [accessSaving, setAccessSaving] = useState(false)
const [accessMsg, setAccessMsg] = useState<string | null>(null)
  const [hoursOpen, setHoursOpen] = useState(false)
const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  // Staff hours for the selected operator; typed with StaffHoursRow
  const [staffHours, setStaffHours] = useState<StaffHoursRow[]>([])
const [openStaffId, setOpenStaffId] = useState<string | null>(null)
const orderedStaffHours = useMemo(() => {
  const map = new Map(staffHours.map(r => [r.dow, r]))

  return STAFF_DOW_ORDER
    .map(dow => map.get(dow))
    .filter((r): r is StaffHoursRow => Boolean(r))
}, [staffHours])

function toggleAllowedPage(key: string) {
  setAllowedPages(prev =>
    prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key],
  )
}

async function createStaffAccess() {
  const username = accessUsername.trim().toLowerCase().replace(/\s+/g, '')
  const password = accessPassword.trim()

  if (username.length < 3) {
    setError('Username accesso non valido: minimo 3 caratteri.')
    return
  }

  if (password.length < 6) {
    setError('Password accesso non valida: minimo 6 caratteri.')
    return
  }

  if (allowedPages.length === 0) {
    setError('Seleziona almeno una pagina accessibile.')
    return
  }

  setAccessSaving(true)
  setError(null)
  setAccessMsg(null)

  try {
    const res = await fetch('/api/admin/staff/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenantId,
        username,
        password,
        allowed_pages: allowedPages,
      }),
    })

    const rawText = await res.text()

    // Parse the JSON response and type it as StaffAccessApiResponse
    let data: StaffAccessApiResponse = {}
    try {
      data = rawText ? (JSON.parse(rawText) as StaffAccessApiResponse) : {}
    } catch {
      data = {}
    }

    if (!res.ok) {
      throw new Error(
        [
          `HTTP ${res.status} ${res.statusText}`,
          data.error || rawText || 'Errore creazione accesso staff.',
          data.step ? `step=${data.step}` : '',
          data.code ? `code=${data.code}` : '',
          data.details ? `details=${data.details}` : '',
          data.hint ? `hint=${data.hint}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
      )
    }
    setAccessMsg(
      `Accesso creato per ${username}. Codice attività: ${data.staff_login_code || staffLoginCode || '—'}`,
    )
    setAccessUsername('')
    setAccessPassword('')
    setAllowedPages(['bookings', 'calendar'])
    await loadStaffAccesses()
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'Errore creazione accesso staff.'
    setError(message)
  } finally {
    setAccessSaving(false)
  }
}
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

  setStaffHours((data || []) as StaffHoursRow[])
}

function updateHour(dow: number, patch: Partial<StaffHoursRow>) {
  setStaffHours(prev =>
    prev.map(r => (r.dow === dow ? { ...r, ...patch } : r)),
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
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Errore caricamento staff.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStaff()
    loadStaffAccesses()
    loadStaffLoginCode()
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
    const { data: newStaff, error } = await supabase
      .from('staff_members')
      .insert({
        tenant_id: tenantId,
        name: trimmed,
        is_active: true,
        position: nextPosition,
      })
      .select('id, tenant_id, name, is_active, position')
      .single()

    if (error) throw error
    if (!newStaff?.id) throw new Error('Operatore creato, ma ID non disponibile.')

    const { data: tenantHours, error: hoursErr } = await supabase
      .from('tenant_hours')
      .select(
        'dow, open_time_am, close_time_am, pm_enabled, open_time_pm, close_time_pm, is_closed',
      )
      .eq('tenant_id', tenantId)

    if (hoursErr) throw hoursErr

    const defaultRows = [0, 1, 2, 3, 4, 5, 6].map(dow => ({
      tenant_id: tenantId,
      staff_id: newStaff.id,
      dow,
      open_time_am: dow === 0 ? null : '09:00:00',
      close_time_am: dow === 0 ? null : '12:30:00',
      pm_enabled: dow === 0 ? false : true,
      open_time_pm: dow === 0 ? null : '15:00:00',
      close_time_pm: dow === 0 ? null : '19:00:00',
      is_closed: dow === 0,
    }))

    const rowsToInsert =
      tenantHours && tenantHours.length > 0
        ? (
            tenantHours as Array<{
              dow: number
              is_closed?: boolean | null
              open_time_am?: string | null
              close_time_am?: string | null
              pm_enabled?: boolean | null
              open_time_pm?: string | null
              close_time_pm?: string | null
            }>
          ).map(h => ({
            tenant_id: tenantId,
            staff_id: newStaff.id,
            dow: h.dow,
            open_time_am: h.is_closed ? null : h.open_time_am || '09:00:00',
            close_time_am: h.is_closed ? null : h.close_time_am || '12:30:00',
            pm_enabled: h.is_closed ? false : !!h.pm_enabled,
            open_time_pm: h.is_closed ? null : h.open_time_pm || '15:00:00',
            close_time_pm: h.is_closed ? null : h.close_time_pm || '19:00:00',
            is_closed: !!h.is_closed,
          }))
        : defaultRows

    const { error: staffHoursErr } = await supabase
      .from('staff_hours')
      .upsert(rowsToInsert, { onConflict: 'staff_id,dow' })

    if (staffHoursErr) throw staffHoursErr

    setName('')
    await loadStaff()
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'Errore inserimento.'
    setError(message)
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
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Errore aggiornamento.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

async function removeStaff(id: string) {
  const staffMember = rows.find(r => r.id === id)
  const staffName = staffMember?.name || 'questo operatore'

  setSaving(true)
  setError(null)

  try {
    const { count, error: countErr } = await supabase
      .from('service_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', id)

    if (countErr) throw countErr

    if ((count || 0) > 0) {
      const ok = confirm(
        `${staffName} è già collegato a una o più prenotazioni. Per mantenere corretto lo storico, è meglio disattivarlo invece di eliminarlo. Vuoi disattivarlo?`,
      )

      if (!ok) return

      const { error: updateErr } = await supabase
        .from('staff_members')
        .update({ is_active: false })
        .eq('id', id)

      if (updateErr) throw updateErr

      setRows(prev =>
        prev.map(r => (r.id === id ? { ...r, is_active: false } : r)),
      )

      return
    }

    const ok = confirm(`Vuoi davvero eliminare definitivamente ${staffName}?`)

    if (!ok) return

    const { error } = await supabase
      .from('staff_members')
      .delete()
      .eq('id', id)

    if (error) throw error

    setRows(prev => prev.filter(r => r.id !== id))
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'Errore eliminazione operatore.'
    setError(message)
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
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Errore riordino.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }
async function loadStaffAccesses() {
  if (!tenantId) return

  setLoadingAccesses(true)

  try {
    const { data, error } = await supabase
      .from('tenant_users')
      .select('id, tenant_id, user_id, username, role, allowed_pages, is_active')
      .eq('tenant_id', tenantId)
      .eq('role', 'staff')
      .order('username', { ascending: true })

    if (error) throw error

    setStaffAccesses((data || []) as StaffAccess[])
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'Errore caricamento accessi staff.'
    setError(message)
  } finally {
    setLoadingAccesses(false)
  }
}
async function deleteStaffAccess(access: StaffAccess) {
  const ok = confirm(
    `Eliminare definitivamente l'accesso "${access.username || 'staff'}"?\n\nL'utente verrà rimosso sia da Slotta sia da Supabase Auth.`,
  )

  if (!ok) return

  setError(null)

  try {
    const res = await fetch('/api/admin/staff/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenantId,
        user_id: access.user_id,
      }),
    })

    const rawText = await res.text()

    // Parse the JSON response and type it as StaffAccessApiResponse
    let data: StaffAccessApiResponse = {}
    try {
      data = rawText ? (JSON.parse(rawText) as StaffAccessApiResponse) : {}
    } catch {
      data = {}
    }

    if (!res.ok) {
      throw new Error(
        [
          data.error || rawText || 'Errore eliminazione accesso staff.',
          data.step ? `step=${data.step}` : '',
          data.code ? `code=${data.code}` : '',
          data.details ? `details=${data.details}` : '',
          data.hint ? `hint=${data.hint}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
      )
    }

    setStaffAccesses(prev =>
      prev.filter(a => a.user_id !== access.user_id),
    )
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'Errore eliminazione accesso staff.'
    setError(message)
  }
}
   return (
  <main className="min-h-screen bg-[#F2F4F7] px-4 py-5 text-[#0F1D2D] md:px-6">
    <div className="mx-auto grid max-w-7xl gap-5">
      <header>
  <p className="hidden md:block text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
    Area gestore
  </p>

  <h1 className="hidden md:block text-3xl font-black tracking-tight text-[#0F1D2D]">
    Staff & accessi
  </h1>

  <p className="text-sm text-slate-600 md:mt-1">
    Aggiungi operatori e gestisci disponibilità e accessi.
  </p>
</header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {/* AGGIUNGI OPERATORE */}
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        {/* HEADER DESKTOP */}
<div className="hidden border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 md:block">
  <div className="flex items-start justify-between gap-3">
    <div>
      <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
        Nuovo operatore
      </p>
      <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
        Aggiungi operatore
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Gli operatori attivi possono essere assegnati alle prenotazioni.
      </p>
    </div>

    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E6FFFA] text-[#1FA7A6] shadow-sm">
      +
    </div>
  </div>
</div>

<MobileSectionHeader
  eyebrow="Nuovo operatore"
  title="Aggiungi operatore"
  open={mobileSections.addStaff}
  onToggle={() => toggleMobileSection('addStaff')}
/>

  <StaffAccessPanel
  open={mobileSections.accesses}
  staffLoginCode={staffLoginCode}
  accessMsg={accessMsg}
  accessUsername={accessUsername}
  accessPassword={accessPassword}
  allowedPages={allowedPages}
  accessSaving={accessSaving}
  tenantId={tenantId}
  loadingAccesses={loadingAccesses}
  staffAccesses={staffAccesses}
  setAccessUsername={setAccessUsername}
  setAccessPassword={setAccessPassword}
  toggleAllowedPage={toggleAllowedPage}
  createStaffAccess={createStaffAccess}
  deleteStaffAccess={deleteStaffAccess}
/>
      </section>

      {/* OPERATORI */}
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        {/* HEADER DESKTOP */}
<div className="hidden items-center justify-between border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 md:flex">
  <div>
    <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
      Operatori
    </p>
    <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
      Staff del salone
    </h2>
  </div>

  <span className="rounded-full border border-[#D7EEF0] bg-white px-3 py-1.5 text-xs font-black text-[#1FA7A6] shadow-sm">
    {rows.length} totali
  </span>
</div>

<MobileSectionHeader
  eyebrow="Operatori"
  title="Operatori configurati"
  open={mobileSections.operators}
  onToggle={() => toggleMobileSection('operators')}
/>
        <div className={mobileSections.operators ? 'block' : 'hidden md:block'}>
  {loading ? (
    <div className="p-5 text-sm text-slate-500">Caricamento…</div>
  ) : rows.length === 0 ? (
    <div className="p-5 text-sm text-slate-500">
      Nessun operatore inserito.
    </div>
  ) : (
    <div className="grid gap-2 p-3 md:gap-3 md:p-4">
      {rows.map((r, i) => (
        <div
          key={r.id}
          className={[
            'overflow-hidden rounded-[1.5rem] border bg-white shadow-sm transition',
            r.is_active ? 'border-slate-200' : 'border-slate-200 opacity-70',
          ].join(' ')}
        >
          <button
            type="button"
            onClick={() => setOpenStaffId(openStaffId === r.id ? null : r.id)}
            className="flex w-full items-center gap-3 p-3 text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0F1D2D] text-sm font-black text-white">
              {r.name?.charAt(0)?.toUpperCase() || 'O'}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-[#0F1D2D]">
                {r.name}
              </div>

              <div className="mt-1 flex items-center gap-2">
                {r.is_active ? (
                  <span className="rounded-full bg-[#E6FFFA] px-2.5 py-1 text-[11px] font-black text-[#0F766E]">
                    Attivo
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">
                    Non attivo
                  </span>
                )}

                <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-[11px] font-bold text-slate-600">
                  Ordine: {r.position}
                </span>
              </div>
            </div>

            <span className="text-sm font-black text-slate-400">
              {openStaffId === r.id ? '▲' : '▼'}
            </span>
          </button>

          {openStaffId === r.id && (
  <div className="grid gap-3 border-t border-slate-100 p-3">
    <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
      <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm font-bold text-slate-700">
        <span>Operatore attivo</span>

        <input
          type="checkbox"
          checked={r.is_active}
          onChange={e => updateStaff(r.id, { is_active: e.target.checked })}
          className="h-4 w-4"
          disabled={saving}
        />
      </label>

      <button
        type="button"
        onClick={() => openHours(r)}
        disabled={saving}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Orari operatore
      </button>
    </div>

    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => move(r.id, -1)}
        disabled={saving || i === 0}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-[#1FA7A6] hover:text-[#1FA7A6] disabled:cursor-not-allowed disabled:opacity-40"
      >
        ↑ Su
      </button>

      <button
        type="button"
        onClick={() => move(r.id, 1)}
        disabled={saving || i === rows.length - 1}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-[#1FA7A6] hover:text-[#1FA7A6] disabled:cursor-not-allowed disabled:opacity-40"
      >
        ↓ Giù
      </button>

      <button
        type="button"
        onClick={() => removeStaff(r.id)}
        disabled={saving}
        className="ml-auto rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Elimina
      </button>
    </div>
  </div>
)}
        </div>
      ))}
    </div>
  )}
</div>
      </section>
{/* ACCESSI GESTIONALI */}
<section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
  {/* HEADER DESKTOP */}
<div className="hidden items-center justify-between border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 md:flex">
  <div>
    <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
      Accessi gestionali
    </p>
    <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
     Account per il gestionale
    </h2>
    <p className="mt-1 text-sm text-slate-500">
      Dai accesso al gestionale senza condividere il tuo account.
    </p>
  </div>
</div>

<MobileSectionHeader
  eyebrow="Accessi staff"
  title="Accessi e permessi"
  open={mobileSections.accesses}
  onToggle={() => toggleMobileSection('accesses')}
/>


</section>
      {/* MODALE ORARI OPERATORE */}
      {hoursOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1D2D]/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-[#F8FAFC] p-4">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
                  Orari operatore
                </p>
                <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
                  {selectedStaff.name}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
  Personalizza gli orari di disponibilità.
</p>
              </div>

              <button
                onClick={() => setHoursOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold transition hover:bg-slate-50"
              >
                Chiudi
              </button>
            </div>
<div className="max-h-[calc(90vh-150px)] overflow-y-auto p-4 md:p-5">
  <div className="grid gap-2">
    {orderedStaffHours.map(r => (
      <div
        key={r.dow}
        className={[
          'rounded-2xl border p-3',
          r.is_closed
            ? 'border-slate-200 bg-slate-50 text-slate-400'
            : 'border-slate-200 bg-white',
        ].join(' ')}
      >
        {/* MOBILE compatto */}
        <div className="grid gap-2 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F2F4F7] text-sm font-black text-[#0F1D2D]">
              {STAFF_DOW_LABEL[r.dow]}
            </div>

            <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={!!r.is_closed}
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
                className="h-4 w-4"
              />
              Chiuso
            </label>
          </div>

          {!r.is_closed && (
            <div className="grid gap-2">
              <div className="grid grid-cols-[72px_1fr_auto_1fr] items-center gap-2">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  Matt.
                </div>

                <input
                  type="time"
                  value={r.open_time_am?.slice(0, 5) || ''}
                  onChange={e =>
                    updateHour(r.dow, { open_time_am: e.target.value || null })
                  }
                  className="h-10 min-w-0 rounded-2xl border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#1FA7A6]"
                />

                <span className="text-xs text-slate-400">→</span>

                <input
                  type="time"
                  value={r.close_time_am?.slice(0, 5) || ''}
                  onChange={e =>
                    updateHour(r.dow, { close_time_am: e.target.value || null })
                  }
                  className="h-10 min-w-0 rounded-2xl border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#1FA7A6]"
                />
              </div>

              <div className="grid grid-cols-[72px_1fr_auto_1fr] items-center gap-2">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  Pom.
                </div>

                <input
                  type="time"
                  value={r.open_time_pm?.slice(0, 5) || ''}
                  onChange={e =>
                    updateHour(r.dow, { open_time_pm: e.target.value || null })
                  }
                  className="h-10 min-w-0 rounded-2xl border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#1FA7A6]"
                />

                <span className="text-xs text-slate-400">→</span>

                <input
                  type="time"
                  value={r.close_time_pm?.slice(0, 5) || ''}
                  onChange={e =>
                    updateHour(r.dow, { close_time_pm: e.target.value || null })
                  }
                  className="h-10 min-w-0 rounded-2xl border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#1FA7A6]"
                />
              </div>
            </div>
          )}
        </div>

        {/* DESKTOP come prima */}
        <div className="hidden gap-3 md:grid md:grid-cols-[70px_1fr_1fr_auto] md:items-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F2F4F7] text-sm font-black text-[#0F1D2D]">
            {STAFF_DOW_LABEL[r.dow]}
          </div>

          <div className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-slate-400">
              Mattino
            </span>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                type="time"
                value={r.open_time_am?.slice(0, 5) || ''}
                onChange={e =>
                  updateHour(r.dow, { open_time_am: e.target.value || null })
                }
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1FA7A6] disabled:bg-slate-100"
                disabled={!!r.is_closed}
              />

              <span className="text-slate-400">→</span>

              <input
                type="time"
                value={r.close_time_am?.slice(0, 5) || ''}
                onChange={e =>
                  updateHour(r.dow, { close_time_am: e.target.value || null })
                }
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1FA7A6] disabled:bg-slate-100"
                disabled={!!r.is_closed}
              />
            </div>
          </div>

          <div className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-slate-400">
              Pomeriggio
            </span>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                type="time"
                value={r.open_time_pm?.slice(0, 5) || ''}
                onChange={e =>
                  updateHour(r.dow, { open_time_pm: e.target.value || null })
                }
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1FA7A6] disabled:bg-slate-100"
                disabled={!!r.is_closed}
              />

              <span className="text-slate-400">→</span>

              <input
                type="time"
                value={r.close_time_pm?.slice(0, 5) || ''}
                onChange={e =>
                  updateHour(r.dow, { close_time_pm: e.target.value || null })
                }
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1FA7A6] disabled:bg-slate-100"
                disabled={!!r.is_closed}
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-sm font-bold text-slate-700 md:justify-center">
            <input
              type="checkbox"
              checked={!!r.is_closed}
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
              className="h-4 w-4"
            />
            Chiuso
          </label>
        </div>
      </div>
    ))}
  </div>
</div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-white p-4">
              <button
                onClick={() => setHoursOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#0F1D2D] transition hover:bg-slate-50"
              >
                Annulla
              </button>

              <button
                onClick={saveHours}
                className="rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:brightness-95"
              >
                Salva orari
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </main>
)
}
