'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Order = {
  id: string
  tenant_id: string
  customer_name: string | null
  status: string
  payment_status: string
  total_cents: number
  created_at: string
  tenant?: { slug: string; name: string }
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [tenants, setTenants] = useState<{ id: string; slug: string; name: string }[]>([])
  const [filterTenant, setFilterTenant] = useState<string>('') // slug

  async function load() {
    // carica tenants per il filtro
    const t = await supabase.from('tenants').select('id, slug, name').order('name', { ascending: true })
    setTenants(t.data || [])

    // carica ordini (ultimi per primi)
    const { data } = await supabase
      .from('orders')
      .select('id, tenant_id, customer_name, status, payment_status, total_cents, created_at')
      .order('created_at', { ascending: false })
    const base = data || []

    // arricchisci con info tenant (client-side join)
    const withTenant = base.map(o => {
      const ten = t.data?.find(x => x.id === o.tenant_id)
      return { ...o, tenant: ten ? { slug: ten.slug, name: ten.name } : undefined }
    })
    setOrders(withTenant)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!filterTenant) return orders
    return orders.filter(o => o.tenant?.slug === filterTenant)
  }, [orders, filterTenant])

  async function toggleDone(id: string, done: boolean) {
    await supabase.from('orders').update({ status: done ? 'done' : 'preparing' }).eq('id', id)
    load()
  }

  async function deleteAllDone() {
    await supabase.from('orders').delete().eq('status', 'done')
    load()
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <h1 className="text-2xl font-bold">Ordini</h1>

        <div className="flex gap-2">
          <select
            value={filterTenant}
            onChange={(e) => setFilterTenant(e.target.value)}
            className="border rounded px-3 py-2"
            title="Filtra per locale"
          >
            <option value="">Tutti i locali</option>
            {tenants.map(t => (
              <option key={t.id} value={t.slug}>{t.name} ({t.slug})</option>
            ))}
          </select>

          <button
            onClick={deleteAllDone}
            className="px-3 py-2 rounded bg-red-600 text-white"
            title="Elimina tutti gli ordini segnati come fatti"
          >
            Cancella tutti i fatti
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map(o => (
          <div key={o.id} className="border rounded p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">
                #{o.id.slice(0,8)} — {o.tenant?.name ?? 'Sconosciuto'} {o.tenant?.slug ? `(${o.tenant.slug})` : ''}
              </div>
              <div className="text-sm text-zinc-600">{new Date(o.created_at).toLocaleString()}</div>
              <div className="text-sm">Cliente: {o.customer_name || '-'}</div>
              <div className="text-sm">Stato: <b>{o.status}</b> — Pagamento: <b>{o.payment_status}</b></div>
              <div className="text-sm">Totale: € {(o.total_cents/100).toFixed(2)}</div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={o.status === 'done'}
                onChange={e => toggleDone(o.id, e.target.checked)}
              />
              <span>Fatto</span>
            </label>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-sm text-zinc-600">Nessun ordine trovato.</div>
        )}
      </div>
    </main>
  )
}
