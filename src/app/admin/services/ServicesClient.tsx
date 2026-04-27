'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const IMAGE_BUCKET = 'service-images'

type ServiceRow = {
  id: string
  tenant_id: string
  name: string
  description?: string | null
  duration_minutes: number
  price_cents: number
  image_url?: string | null
  is_active: boolean
}

type ToastType = 'success' | 'error' | 'info'
type ToastState = { type: ToastType; message: string } | null

function centsToEuro(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2)
}

function euroToCents(v: string) {
  const num = parseFloat(v.replace(',', '.'))
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}

async function uploadImageForTenant(file: File, tenantId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = `${tenantId}/${fileName}`

  const { error: uploadErr } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })

  if (uploadErr) throw uploadErr

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function Thumbnail({ url, alt }: { url?: string | null; alt: string }) {
  if (!url) {
    return (
      <div className="h-12 w-12 rounded-lg bg-zinc-100 border flex items-center justify-center text-xs text-zinc-400">
        —
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      className="h-12 w-12 rounded-lg object-cover border bg-white"
    />
  )
}

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
  const [newDuration, setNewDuration] = useState(60)
  const [newPriceEuro, setNewPriceEuro] = useState('50.00')
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
    setEditPriceEuro(centsToEuro(service.price_cents))
    setEditImageFile(null)
    setEditOpen(true)
  }

  function closeEdit() {
    setEditOpen(false)
    setEditRow(null)
    setEditImageFile(null)
    setSaving(false)
  }

  async function loadServices(id: string) {
    if (!id) return

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('services')
        .select(
          'id, tenant_id, name, description, duration_minutes, price_cents, image_url, is_active',
        )
        .eq('tenant_id', id)
        .order('name', { ascending: true })

      if (error) throw error

      setServices(
        (data || []).map((s: any) => ({
          ...s,
          is_active: s.is_active !== false,
        })) as ServiceRow[],
      )
    } catch (e: any) {
      console.error(e)
      setError(e?.message || 'Errore nel caricamento dei servizi.')
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

    setSaving(true)

    try {
      let imageUrl: string | null = null
      if (newImageFile) imageUrl = await uploadImageForTenant(newImageFile, tenantId)

      const priceCents = euroToCents(newPriceEuro)

      const { data, error } = await supabase
        .from('services')
        .insert({
          tenant_id: tenantId,
          name: newName.trim(),
          description: newDescription || null,
          duration_minutes: newDuration || 0,
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
      setNewDuration(60)
      setNewPriceEuro('50.00')
      setNewImageFile(null)

      showToast('success', 'Servizio creato!')
    } catch (e: any) {
      console.error(e)
      showToast('error', e?.message || 'Errore nella creazione del servizio.')
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
    } catch (e: any) {
      console.error(e)
      setServices(prev => prev.map(s => (s.id === service.id ? { ...s, is_active: !next } : s)))
      showToast('error', e?.message || 'Errore aggiornando lo stato.')
    }
  }

  async function saveEdit() {
    if (!tenantId || !editRow) return

    if (!editRow.name.trim()) {
      showToast('error', 'Inserisci un nome per il servizio')
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
        duration_minutes: editRow.duration_minutes || 0,
        price_cents: euroToCents(editPriceEuro),
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
    } catch (e: any) {
      console.error(e)
      showToast('error', e?.message || 'Errore nel salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteRow(id: string) {
    if (!confirm('Vuoi davvero cancellare questo servizio?')) return

    try {
      const { error } = await supabase.from('services').delete().eq('id', id)
      if (error) throw error

      setServices(prev => prev.filter(s => s.id !== id))
      showToast('success', 'Servizio cancellato')

      if (editRow?.id === id) closeEdit()
    } catch (e: any) {
      console.error(e)
      showToast('error', e?.message || 'Errore nella cancellazione.')
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6 grid gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Servizi</h1>
          <p className="text-sm text-zinc-600">Gestisci i servizi visibili ai clienti.</p>
        </div>

        <div className="text-xs text-zinc-500">Tenant attivo</div>
      </div>

      {error && (
        <div className="text-sm text-red-700 border rounded-xl p-3 bg-red-50">
          {error}
        </div>
      )}

      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-md text-sm border bg-white ${
            toast.type === 'success'
              ? 'border-green-200'
              : toast.type === 'error'
              ? 'border-red-200'
              : 'border-zinc-200'
          }`}
        >
          <div className="font-medium">
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}{' '}
            {toast.message}
          </div>
        </div>
      )}

      <section className="border rounded-2xl p-4 bg-white grid gap-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Nuovo servizio</h2>
          <span className="text-xs text-zinc-500">Tenant attivo</span>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-sm">Nome servizio</span>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="border rounded-xl px-3 py-2"
              placeholder="Es. Colore, Taglio, Piega…"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Durata (minuti)</span>
            <input
              type="number"
              min={10}
              step={5}
              value={newDuration}
              onChange={e => setNewDuration(Number(e.target.value || 0))}
              className="border rounded-xl px-3 py-2"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Prezzo (€)</span>
            <input
              value={newPriceEuro}
              onChange={e => setNewPriceEuro(e.target.value)}
              className="border rounded-xl px-3 py-2"
              placeholder="Es. 50.00"
              inputMode="decimal"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm">Immagine</span>
            <input
              id="new-service-image"
              type="file"
              accept="image/*"
              onChange={e => setNewImageFile(e.target.files?.[0] || null)}
              className="hidden"
            />

            <label
              htmlFor="new-service-image"
              className="inline-flex w-fit items-center gap-2 px-4 py-2 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-800 transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-md hover:border-zinc-400 hover:ring-2 hover:ring-zinc-200 hover:ring-offset-1 active:translate-y-0 active:shadow-sm active:ring-zinc-300 cursor-pointer select-none"
            >
              <span className="mr-2">🖼️</span>
              Inserisci immagine
            </label>
          </label>
        </div>

        <div className="grid md:grid-cols-[1fr,220px] gap-3 items-start">
          <label className="grid gap-1">
            <span className="text-sm">Descrizione</span>
            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              className="border rounded-xl px-3 py-2"
              placeholder="Descrizione breve (visibile al cliente)"
              rows={3}
              maxLength={220}
            />
            <span className="text-xs text-zinc-500">{newDescription.length}/220</span>
          </label>

          <div className="grid gap-2">
            <span className="text-sm">Anteprima</span>
            <div className="border rounded-2xl p-3 bg-zinc-50">
              <div className="flex items-start gap-3">
                <img
                  src={
                    newImagePreview ||
                    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="%23f4f4f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10">Nessuna immagine</text></svg>'
                  }
                  alt=""
                  className="h-16 w-16 rounded-xl object-cover border bg-white"
                />
                <div className="min-w-0">
                  <div className="font-semibold truncate">{newName || 'Nome servizio'}</div>
                  <div className="text-xs text-zinc-600 mt-1">
                    {newDuration || 0} min • € {newPriceEuro || '0.00'}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 line-clamp-2">
                    {newDescription || 'Descrizione…'}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={createService}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvataggio…' : 'Aggiungi servizio'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Servizi esistenti</h2>
          <span className="text-xs text-zinc-500">{services.length} totali</span>
        </div>

        {loading && <div className="text-sm text-zinc-600">Caricamento servizi…</div>}

        {!loading && services.length === 0 && (
          <div className="text-sm text-zinc-600">Nessun servizio disponibile per questo locale.</div>
        )}

        {!loading && services.length > 0 && (
          <div className="grid gap-2">
            {services.map(s => (
              <div key={s.id} className="border rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <Thumbnail url={s.image_url} alt={s.name} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold truncate">{s.name}</div>
                        {!s.is_active && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                            Nascosto
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <div className="text-xs text-zinc-600 mt-1 line-clamp-2">
                          {s.description}
                        </div>
                      )}
                      <div className="text-xs text-zinc-500 mt-2">
                        <span className="font-medium text-zinc-700">{s.duration_minutes} min</span>
                        {' • '}
                        <span className="font-medium text-zinc-700">
                          € {centsToEuro(s.price_cents)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <label className="flex items-center gap-2 text-xs text-zinc-600">
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
                      className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50"
                    >
                      Modifica
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteRow(s.id)}
                      className="px-3 py-2 rounded-xl border text-sm hover:bg-red-50"
                      style={{ borderColor: '#fecaca', color: '#b91c1c' }}
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

      {editOpen && editRow && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <div className="font-semibold">Modifica servizio</div>
                <div className="text-xs text-zinc-500">{editRow.name}</div>
              </div>
              <button
                onClick={closeEdit}
                className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50"
              >
                Chiudi
              </button>
            </div>

            <div className="p-4 grid gap-4">
              <div className="grid md:grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-sm">Nome</span>
                  <input
                    value={editRow.name}
                    onChange={e => setEditRow({ ...editRow, name: e.target.value })}
                    className="border rounded-xl px-3 py-2"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm">Durata (min)</span>
                  <input
                    type="number"
                    min={10}
                    step={5}
                    value={editRow.duration_minutes}
                    onChange={e =>
                      setEditRow({
                        ...editRow,
                        duration_minutes: Number(e.target.value || 0),
                      })
                    }
                    className="border rounded-xl px-3 py-2"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm">Prezzo (€)</span>
                  <input
                    value={editPriceEuro}
                    onChange={e => setEditPriceEuro(e.target.value)}
                    className="border rounded-xl px-3 py-2"
                    inputMode="decimal"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm">Visibile ai clienti</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editRow.is_active}
                      onChange={e => setEditRow({ ...editRow, is_active: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-zinc-600">
                      {editRow.is_active ? 'Attivo' : 'Nascosto'}
                    </span>
                  </div>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-sm">Descrizione</span>
                <textarea
                  value={editRow.description || ''}
                  onChange={e => setEditRow({ ...editRow, description: e.target.value })}
                  className="border rounded-xl px-3 py-2"
                  rows={4}
                  maxLength={220}
                />
                <span className="text-xs text-zinc-500">
                  {(editRow.description || '').length}/220
                </span>
              </label>

              <div className="grid md:grid-cols-[1fr,220px] gap-3 items-start">
                <label className="grid gap-2">
                  <span className="text-sm">Cambia immagine</span>

                  <label
                    className={[
                      'inline-flex w-fit items-center justify-center',
                      'px-4 py-2 rounded-xl border text-sm font-medium',
                      'bg-white shadow-sm',
                      'transition-all',
                      'hover:-translate-y-[1px] hover:shadow-md hover:bg-zinc-50',
                      'active:translate-y-0 active:shadow-sm',
                      'cursor-pointer select-none',
                    ].join(' ')}
                  >
                    <span className="mr-2">🖼️</span>
                    Inserisci immagine
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
                      className="text-xs px-3 py-2 rounded-xl border hover:bg-zinc-50 w-fit"
                    >
                      Rimuovi
                    </button>
                  ) : null}

                  <span className="text-xs text-zinc-500">
                    Se selezioni un file, verrà caricata una nuova immagine.
                  </span>
                </label>

                <div className="grid gap-2">
                  <span className="text-sm">Anteprima</span>
                  <div className="border rounded-2xl p-3 bg-zinc-50">
                    <div className="flex items-start gap-3">
                      <img
                        src={
                          editImagePreview ||
                          editRow.image_url ||
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="%23f4f4f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10">Nessuna immagine</text></svg>'
                        }
                        alt=""
                        className="h-16 w-16 rounded-xl object-cover border bg-white"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{editRow.name}</div>
                        <div className="text-xs text-zinc-600 mt-1">
                          {editRow.duration_minutes} min • €{' '}
                          {editPriceEuro || centsToEuro(editRow.price_cents)}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1 line-clamp-2">
                          {editRow.description || 'Descrizione…'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => deleteRow(editRow.id)}
                  className="px-4 py-2 rounded-xl border"
                  style={{ borderColor: '#fecaca', color: '#b91c1c' }}
                  disabled={saving}
                >
                  Elimina
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="px-4 py-2 rounded-xl border hover:bg-zinc-50"
                    disabled={saving}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={saving}
                  >
                    {saving ? 'Salvataggio…' : 'Salva modifiche'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}