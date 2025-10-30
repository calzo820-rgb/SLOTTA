'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Tenant = { id: string; slug: string; name: string }
type Addon = { id: string; tenant_id: string; name: string; price_cents: number; position: number; is_active: boolean }

export default function ExtrasAdmin() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState<string>('')
  const [items, setItems] = useState<Addon[]>([])

  useEffect(() => {
    (async () => {
      const t = await supabase.from('tenants').select('id,slug,name').order('name')
      const list = (t.data || []) as Tenant[]
      setTenants(list)
      if (list[0]) setTenantId(list[0].id)
    })()
  }, [])

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      const { data } = await supabase
        .from('tenant_addons')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('position', { ascending: true })
      setItems((data as Addon[]) || [])
    })()
  }, [tenantId])

  async function addNew() {
    if (!tenantId) return
    const { data, error } = await supabase.from('tenant_addons').insert({
      tenant_id: tenantId,
      name: 'Ingrediente',
      price_cents: 50,
      position: (items[items.length - 1]?.position || 0) + 1,
      is_active: true
    }).select('*').single()
    if (error) { alert(error.message); return }
    setItems(prev => [...prev, data as Addon])
  }

  async function saveRow(a: Addon) {
    const { error } = await supabase.from('tenant_addons').update({
      name: a.name,
      price_cents: a.price_cents,
      position: a.position,
      is_active: a.is_active
    }).eq('id', a.id)
    if (error) { alert(error.message); return }
    alert('Salvato!')
  }

  async function removeRow(id: string) {
    await supabase.from('tenant_addons').delete().eq('id', id)
    setItems(prev => prev.filter(x => x.id !== id))
  }

  return (
    <main className="max-w-3xl mx-auto p-6 grid gap-4">
      <h1 className="text-2xl font-bold">Extra globali (per locale)</h1>

      <label className="grid gap-2 max-w-md">
        <span className="text-sm">Seleziona locale</span>
        <select value={tenantId} onChange={e => setTenantId(e.target.value)} className="border rounded px-3 py-2">
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
        </select>
      </label>

      <button onClick={addNew} className="px-3 py-2 rounded bg-black text-white w-fit">+ Aggiungi extra</button>

      <div className="grid gap-3">
        {items.map(a => (
          <div key={a.id} className="border rounded p-3 grid md:grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
            <input
              className="border rounded px-3 py-2"
              value={a.name}
              onChange={e => { a.name = e.target.value; setItems([...items]) }}
            />
            <div className="flex items-center gap-2">
              <span className="text-sm">€</span>
              <input
                type="number" step="0.01" min="0"
                className="border rounded px-3 py-2 w-24"
                value={(a.price_cents/100).toFixed(2)}
                onChange={e => { a.price_cents = Math.round(Number(e.target.value || '0') * 100); setItems([...items]) }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Ordine</span>
              <input
                type="number" className="border rounded px-3 py-2 w-20"
                value={a.position}
                onChange={e => { a.position = Number(e.target.value || 0); setItems([...items]) }}
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={a.is_active}
                onChange={e => { a.is_active = e.target.checked; setItems([...items]) }}
              />
              <span className="text-sm">Attivo</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => saveRow(a)} className="px-3 py-2 rounded bg-emerald-600 text-white">Salva</button>
              <button onClick={() => removeRow(a.id)} className="px-3 py-2 rounded border">Elimina</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-sm text-zinc-600">Nessun extra. Aggiungine uno.</div>}
      </div>
    </main>
  )
}
