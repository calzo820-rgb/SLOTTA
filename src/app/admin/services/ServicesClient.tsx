'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { ServiceRow, ToastState, ToastType } from './types'
import {
  centsToEuro,
  euroToCents,
  uploadImageForTenant,
} from './utils'
import { ToastMessage } from './components/ToastMessage'

export default function ServicesClient({ tenantId }: { tenantId: string }) {
  const [services, setServices] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [toast, setToast] = useState<ToastState>(null)
  function showToast(type: ToastType, message: string) {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 2500)
  }

  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDuration, setNewDuration] = useState('30')
  const [newPriceEuro, setNewPriceEuro] = useState('25.00')
  const [newImageFile, setNewImageFile] = useState<File | null>(null)

  const newImagePreview = useMemo(() => {
    if (!newImageFile) return null
    return URL.createObjectURL(newImageFile)
  }, [newImageFile])

  useEffect(() => {
    return () => {
      if (newImagePreview) URL.revokeObjectURL(newImagePreview)
    }
  }, [newImagePreview])

  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState<ServiceRow | null>(null)
  const [editPriceEuro, setEditPriceEuro] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const editImagePreview = useMemo(() => {
    if (!editImageFile) return null
    return URL.createObjectURL(editImageFile)
  }, [editImageFile])

  useEffect(() => {
    return () => {
      if (editImagePreview) URL.revokeObjectURL(editImagePreview)
    }
  }, [editImagePreview])

  function openEdit(service: ServiceRow) {
  setEditRow({ ...service })
  setEditDuration(String(service.duration_minutes || ''))
  setEditPriceEuro(centsToEuro(service.price_cents))
  setEditImageFile(null)
  setEditOpen(true)
}

function closeEdit() {
  setEditOpen(false)
  setEditRow(null)
  setEditDuration('')
  setEditImageFile(null)
  setSaving(false)
}

  async function loadServices(id: string) {
    if (!id) return

    setLoading(true)
    setError(null)

    try {
      // Specify the expected row type for Supabase. This avoids `any` in the
      // response payload and lets TypeScript infer the structure of `data`.
      const { data, error } = await supabase
  .from('services')
  .select(
    'id, tenant_id, name, description, duration_minutes, price_cents, image_url, is_active',
  )
  .eq('tenant_id', id)
  .order('name', { ascending: true })

if (error) throw error

const rows = (data || []) as ServiceRow[]

const mappedServices: ServiceRow[] = rows.map(s => ({
  ...s,
  is_active: s.is_active !== false,
}))

setServices(mappedServices)
    } catch (e: unknown) {
      console.error(e)
      const message =
        e instanceof Error ? e.message : 'Errore nel caricamento dei servizi.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!tenantId) return
    loadServices(tenantId)
  }, [tenantId])

  async function createService() {
    if (!tenantId) {
      showToast('error', 'Tenant non disponibile')
      return
    }

    if (!newName.trim()) {
      showToast('error', 'Inserisci un nome per il servizio')
      return
    }
const durationValue = Number(newDuration)

if (!newDuration.trim() || !Number.isFinite(durationValue) || durationValue <= 0) {
  showToast('error', 'Inserisci una durata valida per il servizio')
  return
}

const priceCents = euroToCents(newPriceEuro)

if (!newPriceEuro.trim() || priceCents < 0) {
  showToast('error', 'Inserisci un prezzo valido.')
  return
}

setSaving(true)

try {
  let imageUrl: string | null = null
  if (newImageFile) imageUrl = await uploadImageForTenant(newImageFile, tenantId)

      const { data, error } = await supabase
        .from('services')
        .insert({
          tenant_id: tenantId,
          name: newName.trim(),
          description: newDescription || null,
          duration_minutes: durationValue,
          price_cents: priceCents,
          image_url: imageUrl,
          is_active: true,
        })
        .select(
          'id, tenant_id, name, description, duration_minutes, price_cents, image_url, is_active',
        )
        .single()

      if (error) throw error

      setServices(prev =>
        [...prev, data as ServiceRow].sort((a, b) => a.name.localeCompare(b.name)),
      )

      setNewName('')
      setNewDescription('')
      setNewDuration('30')
      setNewPriceEuro('25.00')
      setNewImageFile(null)

      showToast('success', 'Servizio creato!')
    } catch (e: unknown) {
      console.error(e)
      const message =
        e instanceof Error
          ? e.message
          : 'Errore nella creazione del servizio.'
      showToast('error', message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(service: ServiceRow, next: boolean) {
    setServices(prev => prev.map(s => (s.id === service.id ? { ...s, is_active: next } : s)))

    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: next })
        .eq('id', service.id)

      if (error) throw error
      showToast('success', next ? 'Servizio attivato' : 'Servizio disattivato')
    } catch (e: unknown) {
      console.error(e)
      setServices(prev =>
        prev.map(s => (s.id === service.id ? { ...s, is_active: !next } : s)),
      )
      const message =
        e instanceof Error ? e.message : 'Errore aggiornando lo stato.'
      showToast('error', message)
    }
  }

  async function saveEdit() {
    if (!tenantId || !editRow) return

    if (!editRow.name.trim()) {
      showToast('error', 'Inserisci un nome per il servizio')
      return
    }
const durationValue = Number(editDuration)

if (!editDuration.trim() || !Number.isFinite(durationValue) || durationValue <= 0) {
  showToast('error', 'Inserisci una durata valida per il servizio')
  return
}

const priceCents = euroToCents(editPriceEuro)

if (!editPriceEuro.trim() || priceCents < 0) {
  showToast('error', 'Inserisci un prezzo valido.')
  return
}

setSaving(true)

try {
  let imageUrl: string | null = editRow.image_url || null
      if (editImageFile) {
        imageUrl = await uploadImageForTenant(editImageFile, tenantId)
      }

      const payload = {
        tenant_id: tenantId,
        name: editRow.name.trim(),
        description: editRow.description || null,
        duration_minutes: durationValue,
        price_cents: priceCents,
        image_url: imageUrl,
        is_active: editRow.is_active,
      }

      const { error } = await supabase.from('services').update(payload).eq('id', editRow.id)
      if (error) throw error

      setServices(prev =>
        prev
          .map(s => (s.id === editRow.id ? { ...s, ...payload } : s))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )

      showToast('success', 'Servizio aggiornato!')
      closeEdit()
    } catch (e: unknown) {
      console.error(e)
      const message =
        e instanceof Error ? e.message : 'Errore nel salvataggio.'
      showToast('error', message)
    } finally {
      setSaving(false)
    }
  }

async function deleteRow(id: string) {
  try {
    const { count, error: countErr } = await supabase
      .from('service_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('service_id', id)

    if (countErr) throw countErr

    if ((count || 0) > 0) {
      const ok = confirm(
        'Questo servizio è già collegato a una o più prenotazioni. Per mantenere corretto lo storico, è meglio nasconderlo invece di eliminarlo. Vuoi nasconderlo dalla pagina cliente?',
      )

      if (!ok) return

      const { error: updateErr } = await supabase
        .from('services')
        .update({ is_active: false })
        .eq('id', id)

      if (updateErr) throw updateErr

      setServices(prev =>
        prev.map(s => (s.id === id ? { ...s, is_active: false } : s)),
      )

      showToast('success', 'Servizio nascosto dalla pagina cliente')

      if (editRow?.id === id) {
        setEditRow(prev => (prev ? { ...prev, is_active: false } : prev))
      }

      return
    }

    if (!confirm('Vuoi davvero eliminare definitivamente questo servizio?')) return

    const { error } = await supabase.from('services').delete().eq('id', id)

    if (error) throw error

    setServices(prev => prev.filter(s => s.id !== id))
    showToast('success', 'Servizio eliminato')

    if (editRow?.id === id) closeEdit()
  } catch (e: unknown) {
    console.error(e)
    const message =
      e instanceof Error ? e.message : 'Errore nella cancellazione.'
    showToast('error', message)
  }
}

  return (
  <main className="min-h-screen bg-[#F2F4F7] px-4 py-5 text-[#0F1D2D] sm:px-6">
    <div className="mx-auto grid max-w-7xl gap-5">
      {/* HEADER PAGINA */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
  <p className="hidden md:block text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
    Area gestore
  </p>

  <h1 className="hidden md:block text-3xl font-black tracking-tight text-[#0F1D2D]">
    Servizi
  </h1>

  <p className="text-sm text-slate-600">
    Crea e modifica i servizi che i clienti potranno prenotare online.
  </p>
</div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

<ToastMessage toast={toast} />

      {/* NUOVO SERVIZIO */}
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-[#F8FAFC] px-5 py-4">
          <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
            Nuovo servizio
          </p>
          <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
            Aggiungi un servizio
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Inserisci nome, durata, prezzo e immagine visibile nella pagina cliente.
          </p>
        </div>

        <div className="grid gap-5 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-sm font-bold text-[#0F1D2D]">Nome servizio</span>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                placeholder="Es. Colore, Taglio, Piega…"
              />
            </label>

            <label className="grid gap-1">
  <span className="text-sm font-bold text-[#0F1D2D]">Durata</span>
  <select
    value={newDuration}
    onChange={e => setNewDuration(e.target.value)}
    className={[
      'h-11 rounded-2xl border bg-white px-4 text-sm outline-none transition focus:ring-2',
      newDuration.trim() === ''
        ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'
        : 'border-slate-200 focus:border-[#1FA7A6] focus:ring-[#1FA7A6]/10',
    ].join(' ')}
  >
   <option value="15">15 minuti</option>
<option value="30">30 minuti</option>
<option value="45">45 minuti</option>
<option value="60">1 ora</option>
<option value="75">1 ora e 15 min</option>
<option value="90">1 ora e 30 min</option>
<option value="105">1 ora e 45 min</option>
<option value="120">2 ore</option>
<option value="135">2 ore e 15 min</option>
<option value="150">2 ore e 30 min</option>
<option value="165">2 ore e 45 min</option>
<option value="180">3 ore</option>
  </select>
  <span className="text-xs text-slate-500">
    Tempo necessario per completare il servizio.
  </span>
</label>

            <label className="grid gap-1">
              <span className="text-sm font-bold text-[#0F1D2D]">Prezzo</span>
              <input
                value={newPriceEuro}
                onChange={e => setNewPriceEuro(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                placeholder="Es. 50.00"
                inputMode="decimal"
              />
              <span className="text-xs text-slate-500">Prezzo in euro</span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_320px]">
  <label className="grid gap-1">
    <span className="text-sm font-bold text-[#0F1D2D]">Descrizione</span>
    <textarea
      value={newDescription}
      onChange={e => setNewDescription(e.target.value)}
      className="min-h-[120px] rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
      placeholder="Descrizione breve visibile al cliente"
      rows={4}
      maxLength={220}
    />
    <span className="text-xs text-slate-500">{newDescription.length}/220</span>
  </label>

  <div className="grid gap-3">
    <div className="grid gap-2">
      <div>
        <span className="text-sm font-bold text-[#0F1D2D]">
          Immagine servizio
        </span>
        <p className="mt-1 text-xs text-slate-500">
          Foto visibile nella pagina cliente.
        </p>
      </div>

      <input
        id="new-service-image"
        type="file"
        accept="image/*"
        onChange={e => setNewImageFile(e.target.files?.[0] || null)}
        className="hidden"
      />

      <label
        htmlFor="new-service-image"
        className="inline-flex w-fit cursor-pointer select-none items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#0F1D2D] shadow-sm transition hover:-translate-y-[1px] hover:border-[#1FA7A6] hover:text-[#1FA7A6] hover:shadow-md"
      >
        <span>🖼️</span>
        <span>Inserisci immagine</span>
      </label>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-[#F8FAFC] p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">
        Anteprima
      </p>

      <div className="flex items-start gap-3">
        <img
          src={
            newImagePreview ||
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="%23f4f4f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10">Nessuna immagine</text></svg>'
          }
          alt=""
          className="h-20 w-20 rounded-2xl border border-slate-200 bg-white object-cover"
        />

        <div className="min-w-0">
          <div className="truncate font-black text-[#0F1D2D]">
            {newName || 'Nome servizio'}
          </div>

          <div className="mt-1 text-xs font-bold text-slate-600">
            {newDuration.trim() ? `${Number(newDuration)} min` : 'Durata mancante'} · € {newPriceEuro || '0.00'}
          </div>

          <div className="mt-1 line-clamp-2 text-xs text-slate-500">
            {newDescription || 'Descrizione del servizio…'}
          </div>
        </div>
      </div>
    </div>

    <button
      onClick={createService}
      disabled={saving}
      className="rounded-2xl bg-[#FFC145] px-4 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:-translate-y-[1px] hover:brightness-95 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
    >
      {saving ? 'Salvataggio…' : 'Aggiungi servizio'}
    </button>
  </div>
</div>
</div>
      </section>

      {/* SERVIZI ESISTENTI */}
      <section className="grid gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-[#0F1D2D]">Servizi esistenti</h2>
            <p className="text-sm text-slate-500">
              Gestisci i servizi già pubblicati nella pagina cliente.
            </p>
          </div>

          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#1FA7A6] shadow-sm">
            {services.length} totali
          </span>
        </div>

        {loading && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Caricamento servizi…
          </div>
        )}

        {!loading && services.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Nessun servizio disponibile per questo locale.
          </div>
        )}

        {!loading && services.length > 0 && (
          <div className="grid gap-3">
            {services.map(s => (
              <div
                key={s.id}
                className={[
                  'rounded-[2rem] border bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md',
                  s.is_active ? 'border-slate-200' : 'border-slate-200 opacity-70',
                ].join(' ')}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    {s.image_url ? (
                      <img
                        src={s.image_url}
                        alt={s.name}
                        className="h-24 w-24 shrink-0 rounded-3xl border border-slate-200 bg-white object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-slate-200 bg-[#F8FAFC] text-xs font-bold text-slate-400">
                        Nessuna immagine
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-black text-[#0F1D2D]">
                          {s.name}
                        </h3>

                        {s.is_active ? (
                          <span className="rounded-full bg-[#E6FFFA] px-2.5 py-1 text-xs font-black text-[#0F766E]">
                            Visibile
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">
                            Nascosto
                          </span>
                        )}
                      </div>

                      {s.description && (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                          {s.description}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                        <span className="rounded-full bg-[#F2F4F7] px-3 py-1">
                          {s.duration_minutes} min
                        </span>

                        <span className="rounded-full bg-[#F2F4F7] px-3 py-1">
                          € {centsToEuro(s.price_cents)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-sm font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={s.is_active}
                        onChange={e => toggleActive(s, e.target.checked)}
                        className="h-4 w-4"
                      />
                      Visibile
                    </label>

                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
                    >
                      Modifica
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteRow(s.id)}
                      className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODALE MODIFICA */}
      {editOpen && editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1D2D]/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-[#F8FAFC] p-5">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
                  Modifica servizio
                </p>
                <h3 className="text-xl font-black text-[#0F1D2D]">
                  {editRow.name}
                </h3>
              </div>

              <button
                onClick={closeEdit}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold transition hover:bg-slate-50"
              >
                Chiudi
              </button>
            </div>

            <div className="max-h-[calc(90vh-90px)] overflow-y-auto p-5">
              <div className="grid gap-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-[#0F1D2D]">Nome</span>
                    <input
                      value={editRow.name}
                      onChange={e => setEditRow({ ...editRow, name: e.target.value })}
                      className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                    />
                  </label>

                  <label className="grid gap-1">
  <span className="text-sm font-bold text-[#0F1D2D]">Durata</span>
  <select
    value={editDuration}
    onChange={e => setEditDuration(e.target.value)}
    className={[
      'h-11 rounded-2xl border bg-white px-4 text-sm outline-none transition focus:ring-2',
      editDuration.trim() === ''
        ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'
        : 'border-slate-200 focus:border-[#1FA7A6] focus:ring-[#1FA7A6]/10',
    ].join(' ')}
  >
 <option value="15">15 minuti</option>
<option value="30">30 minuti</option>
<option value="45">45 minuti</option>
<option value="60">1 ora</option>
<option value="75">1 ora e 15 min</option>
<option value="90">1 ora e 30 min</option>
<option value="105">1 ora e 45 min</option>
<option value="120">2 ore</option>
<option value="135">2 ore e 15 min</option>
<option value="150">2 ore e 30 min</option>
<option value="165">2 ore e 45 min</option>
<option value="180">3 ore</option>
  </select>
</label>

                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-[#0F1D2D]">Prezzo</span>
                    <input
                      value={editPriceEuro}
                      onChange={e => setEditPriceEuro(e.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                      inputMode="decimal"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-[#0F1D2D]">Visibile ai clienti</span>
                    <div className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4">
                      <input
                        type="checkbox"
                        checked={editRow.is_active}
                        onChange={e => setEditRow({ ...editRow, is_active: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-bold text-slate-600">
                        {editRow.is_active ? 'Attivo' : 'Nascosto'}
                      </span>
                    </div>
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-sm font-bold text-[#0F1D2D]">Descrizione</span>
                  <textarea
                    value={editRow.description || ''}
                    onChange={e => setEditRow({ ...editRow, description: e.target.value })}
                    className="min-h-[110px] rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                    rows={4}
                    maxLength={220}
                  />
                  <span className="text-xs text-slate-500">
                    {(editRow.description || '').length}/220
                  </span>
                </label>

                <div className="grid gap-4 md:grid-cols-[1fr_320px]">
                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-[#0F1D2D]">Cambia immagine</span>

                    <label className="inline-flex w-fit cursor-pointer select-none items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#0F1D2D] shadow-sm transition hover:-translate-y-[1px] hover:border-[#1FA7A6] hover:text-[#1FA7A6] hover:shadow-md">
                      🖼️ Inserisci immagine
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          setEditImageFile(f)
                          e.currentTarget.value = ''
                        }}
                      />
                    </label>

                    {editImageFile ? (
                      <button
                        type="button"
                        onClick={() => setEditImageFile(null)}
                        className="w-fit rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold transition hover:bg-slate-50"
                      >
                        Rimuovi
                      </button>
                    ) : null}

                    <span className="text-xs text-slate-500">
                      Se selezioni un file, verrà caricata una nuova immagine.
                    </span>
                  </label>

                  <div className="grid gap-2">
                    <span className="text-sm font-bold text-[#0F1D2D]">Anteprima</span>

                    <div className="rounded-3xl border border-slate-200 bg-[#F8FAFC] p-4">
                      <div className="flex items-start gap-3">
                        <img
                          src={
                            editImagePreview ||
                            editRow.image_url ||
                            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="%23f4f4f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10">Nessuna immagine</text></svg>'
                          }
                          alt=""
                          className="h-20 w-20 rounded-2xl border border-slate-200 bg-white object-cover"
                        />

                        <div className="min-w-0">
                          <div className="truncate font-black text-[#0F1D2D]">
                            {editRow.name}
                          </div>

                          <div className="mt-1 text-xs font-bold text-slate-600">
                            {editDuration.trim() ? `${Number(editDuration)} min` : 'Durata mancante'} · €{' '}
{editPriceEuro || centsToEuro(editRow.price_cents)}
                          </div>

                          <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {editRow.description || 'Descrizione…'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between">
                  <button
                    type="button"
                    onClick={() => deleteRow(editRow.id)}
                    className="rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50"
                    disabled={saving}
                  >
                    Elimina
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeEdit}
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#0F1D2D] transition hover:bg-slate-50 md:flex-none"
                      disabled={saving}
                    >
                      Annulla
                    </button>

                    <button
                      type="button"
                      onClick={saveEdit}
                      className="flex-1 rounded-2xl bg-[#1FA7A6] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"
                      disabled={saving}
                    >
                      {saving ? 'Salvataggio…' : 'Salva modifiche'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </main>
)
}