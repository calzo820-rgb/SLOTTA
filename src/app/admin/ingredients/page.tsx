'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Tenant = { id: string; slug: string; name: string }
type Addon = { id: string; tenant_id: string; name: string; price_cents: number; position: number; is_active: boolean }
type Product = { id: string; ingredients?: string | null }

export default function IngredientsAdmin() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState<string>('')
  const [tenantSlug, setTenantSlug] = useState<string>('')
  const [items, setItems] = useState<Addon[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Carica pizzerie
  useEffect(() => {
    (async () => {
      const t = await supabase.from('tenants').select('id,slug,name').order('name')
      const list = (t.data || []) as Tenant[]
      setTenants(list)
      if (list[0]) {
        setTenantId(list[0].id)
        setTenantSlug(list[0].slug)
      }
    })()
  }, [])

  // Carica ingredienti del tenant
  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('tenant_addons')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('position', { ascending: true })
      setItems((data as Addon[]) || [])
      setLoading(false)
    })()
  }, [tenantId])

  function onPickTenant(id: string) {
    setTenantId(id)
    const t = tenants.find(x => x.id === id)
    setTenantSlug(t?.slug || '')
  }

  function onField(id: string, field: keyof Addon, value: any) {
    setItems(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a))
  }

  async function addNew() {
    if (!tenantId) return
    const nextPos = (items[items.length - 1]?.position || 0) + 1
    const { data, error } = await supabase.from('tenant_addons').insert({
      tenant_id: tenantId,
      name: 'Ingrediente',
      price_cents: 0,
      position: nextPos,
      is_active: true
    }).select('*').single()
    if (error) { alert(error.message); return }
    setItems(prev => [...prev, data as Addon])
  }

  async function saveRow(a: Addon) {
    setSavingId(a.id)
    const { error } = await supabase.from('tenant_addons').update({
      name: a.name,
      price_cents: a.price_cents,
      position: a.position,
      is_active: a.is_active
    }).eq('id', a.id)
    setSavingId(null)
    if (error) { alert(error.message); return }
    // opzionale: toast
  }

  async function removeRow(id: string) {
    if (!confirm('Eliminare questo ingrediente?')) return
    await supabase.from('tenant_addons').delete().eq('id', id)
    setItems(prev => prev.filter(x => x.id !== id))
  }

  // Importa ingredienti dalle pizze (products.ingredients) → crea voci mancanti (prezzo 0)
  async function importFromProducts() {
    if (!tenantId) return
    const { data: prods } = await supabase
      .from('products')
      .select('id, ingredients')
      .eq('tenant_id', tenantId)

    const namesFromProducts = new Set<string>()
    ;(prods as Product[] || []).forEach(p => {
      const raw = p.ingredients || ''
      raw.split(/[|,]/g).map(s => s.trim()).filter(Boolean).forEach(n => {
        namesFromProducts.add(n.toLowerCase())
      })
    })

    // esistenti
    const existingLower = new Set(items.map(i => i.name.toLowerCase()))
    const toCreate = Array.from(namesFromProducts).filter(n => !existingLower.has(n))

    if (toCreate.length === 0) { alert('Nessun nuovo ingrediente da importare.'); return }

    const batch = toCreate.map((n, i) => ({
      tenant_id: tenantId,
      name: n.charAt(0).toUpperCase() + n.slice(1),
      price_cents: 0,
      position: (items[items.length - 1]?.position || 0) + 1 + i,
      is_active: true
    }))

    const { data, error } = await supabase.from('tenant_addons').insert(batch).select('*')
    if (error) { alert(error.message); return }
    setItems(prev => [...prev, ...(data as Addon[])])
    alert(`Importati ${batch.length} ingredienti.`)
  }

  const sorted = useMemo(() => items.slice().sort((a,b)=>a.position - b.position), [items])

  return (
    <main className="max-w-3xl mx-auto p-6 grid gap-4">
      <h1 className="text-2xl font-bold">Gestione ingredienti (per locale)</h1>

      <label className="grid gap-2 max-w-md">
        <span className="text-sm">Seleziona locale</span>
        <select value={tenantId} onChange={e => onPickTenant(e.target.value)} className="border rounded px-3 py-2">
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={addNew} className="px-3 py-2 rounded bg-black text-white">+ Aggiungi ingrediente</button>
        <button onClick={importFromProducts} className="px-3 py-2 rounded border">Importa dagli ingredienti delle pizze</button>
        {loading && <span className="text-sm text-zinc-600">Caricamento…</span>}
      </div>

      <div className="grid gap-3">
        {sorted.map(a => (
          <div key={a.id} className="border rounded p-3 grid md:grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
            <input
              className="border rounded px-3 py-2"
              value={a.name}
              onChange={e => onField(a.id, 'name', e.target.value)}
              placeholder="Nome ingrediente (es. Mozzarella)"
            />

            <div className="flex items-center gap-2">
              <span className="text-sm">€</span>
              <input
                type="number" step="0.01" min="0"
                className="border rounded px-3 py-2 w-24"
                value={(a.price_cents/100).toFixed(2)}
                onChange={e => onField(a.id, 'price_cents', Math.round(Number(e.target.value || '0') * 100))}
                title="Prezzo extra in euro"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">Ordine</span>
              <input
                type="number" className="border rounded px-3 py-2 w-20"
                value={a.position}
                onChange={e => onField(a.id, 'position', Number(e.target.value || 0))}
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={a.is_active}
                onChange={e => onField(a.id, 'is_active', e.target.checked)}
              />
              <span className="text-sm">Attivo</span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => saveRow(a)}
                disabled={savingId === a.id}
                className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-60"
              >
                {savingId === a.id ? '...' : 'Salva'}
              </button>
              <button onClick={() => removeRow(a.id)} className="px-3 py-2 rounded border">Elimina</button>
            </div>
          </div>
        ))}

        {!loading && sorted.length === 0 && (
          <div className="text-sm text-zinc-600">Nessun ingrediente. Aggiungine uno o usa “Importa”.</div>
        )}
      </div>
    </main>
  )
}
