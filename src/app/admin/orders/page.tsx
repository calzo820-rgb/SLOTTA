'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Tenant = { id: string; slug: string; name: string }
type Order = {
  id: string
  tenant_id: string
  customer_name: string
  customer_phone?: string | null
  note?: string | null
  status: 'pending' | 'preparing' | 'done'
  payment_status: 'unpaid' | 'paid'
  total_cents: number
  created_at: string
  ready_by?: string | null
  items?: OrderItemView[]
  order_number?: string | null
}
type OrderItemView = {
  order_id: string
  product_id: string
  product_name: string
  qty: number
  price_cents: number
  addons: { name: string; price_cents: number }[]
  removed: string[]
}

export default function OrdersAdmin() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState<string>('')
  const [tenantSlug, setTenantSlug] = useState<string>('')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<any>(null)

  // carica pizzerie
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

  // polling ordini
  useEffect(() => {
    if (!tenantId) return
    loadOrders()
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => loadOrders(), 5000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function loadOrders() {
    if (!tenantId) return
    setLoading(true)

    // 1) ordini del tenant (ultimi 100)
    const { data: os } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100)

    const baseOrders = (os || []) as Order[]
    if (baseOrders.length === 0) {
      setOrders([])
      setLoading(false)
      return
    }

    // 2) prendi items + prodotto (nome) per questi ordini
    const orderIds = baseOrders.map(o => o.id)
    const { data: items } = await supabase
      .from('order_items')
      .select('order_id, product_id, qty, price_cents, addons, removed')
      .in('order_id', orderIds)

    // 3) mappa product_id -> name (solo prodotti di questo tenant)
    const { data: prods } = await supabase
      .from('products')
      .select('id, name')
      .eq('tenant_id', tenantId)

    const nameByProdId = new Map<string, string>()
    ;(prods || []).forEach(p => nameByProdId.set(p.id, (p as any).name))

    const itemsByOrder: Record<string, OrderItemView[]> = {}
    ;(items || []).forEach((it: any) => {
      const v: OrderItemView = {
        order_id: it.order_id,
        product_id: it.product_id,
        product_name: nameByProdId.get(it.product_id) || 'Prodotto',
        qty: it.qty,
        price_cents: it.price_cents,
        addons: it.addons || [],
        removed: it.removed || []
      }
      ;(itemsByOrder[it.order_id] ||= []).push(v)
    })

    const full = baseOrders.map(o => ({ ...o, items: itemsByOrder[o.id] || [] }))
    setOrders(full)
    setLoading(false)
  }

  function onPickTenant(id: string) {
    setTenantId(id)
    const t = tenants.find(x => x.id === id)
    setTenantSlug(t?.slug || '')
  }

  async function setStatus(orderId: string, status: Order['status']) {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
  }
  async function togglePaid(orderId: string, current: Order['payment_status']) {
    const next = current === 'paid' ? 'unpaid' : 'paid'
    await supabase.from('orders').update({ payment_status: next }).eq('id', orderId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: next } : o))
  }
  async function deleteDone() {
    if (!confirm('Eliminare tutti gli ordini con stato "Fatto"?')) return
    await supabase.from('orders').delete().eq('tenant_id', tenantId).eq('status', 'done')
    setOrders(prev => prev.filter(o => o.status !== 'done'))
  }

  const grouped = useMemo(() => {
    const col: Record<string, Order[]> = { pending: [], preparing: [], done: [] }
    orders.forEach(o => (col[o.status] ||= []).push(o))
    return col
  }, [orders])

  function formatTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <main className="max-w-6xl mx-auto p-6 grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ordini — {tenantSlug || '...'}</h1>
        <div className="flex items-center gap-2">
          <button onClick={loadOrders} className="px-3 py-2 rounded border">Aggiorna</button>
          <button onClick={deleteDone} className="px-3 py-2 rounded border border-red-600 text-red-600">
            Cancella tutti i “Fatto”
          </button>
        </div>
      </div>

      <label className="grid gap-2 max-w-md">
        <span className="text-sm">Seleziona locale</span>
        <select value={tenantId} onChange={e => onPickTenant(e.target.value)} className="border rounded px-3 py-2">
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
        </select>
      </label>

      {loading && <div className="text-sm text-zinc-600">Caricamento…</div>}

      <div className="grid md:grid-cols-3 gap-4">
        {(['pending','preparing','done'] as const).map(col => (
          <section key={col} className="border rounded">
            <header className="p-3 border-b font-semibold capitalize">
              {col === 'pending' ? 'Nuovi' : col === 'preparing' ? 'In preparazione' : 'Fatti'}
            </header>
            <div className="p-3 grid gap-3">
              {grouped[col].length === 0 && <div className="text-sm text-zinc-500">Nessun ordine</div>}

              {grouped[col].map(o => (
                <article key={o.id} className="border rounded p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      {o.customer_name || 'Cliente'} <span className="text-xs text-zinc-500">({formatTime(o.created_at)})</span>
                    </div>
                    <div className="text-sm font-bold">€ {(o.total_cents/100).toFixed(2)}</div>
                  </div>
                  {o.order_number && (
  <div className="text-xs text-zinc-600 mt-1">
    Ordine n° <span className="font-semibold">{o.order_number}</span>
  </div>
)}

                  {(o as any).ready_by && (
                    <div className="text-xs text-zinc-600 mt-1">
                    Pronto per le: {new Date((o as any).ready_by).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    )}

                  {o.customer_phone && (
                    <div className="text-xs text-zinc-600 mt-1">Tel: {o.customer_phone}</div>
                  )}
                  {o.note && o.note.trim() && (
                    <div className="text-xs mt-1"><span className="font-medium">Note:</span> {o.note}</div>
                  )}

                  <ul className="mt-2 grid gap-2">
                    {o.items?.map((it, idx) => {
                      const addons = (it.addons || [])
                      const removed = (it.removed || [])
                      const addonsTxt = addons.length
                        ? `Aggiunte: ${addons.map(a => `${a.name}${a.price_cents ? ` (+€ ${(a.price_cents/100).toFixed(2)})` : ''}`).join(', ')}`
                        : ''
                      const removedTxt = removed.length ? `Senza: ${removed.join(', ')}` : ''
                      return (
                        <li key={idx} className="border rounded p-2">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{it.product_name}</div>
                            <div className="text-sm">× {it.qty}</div>
                          </div>
                          {(addonsTxt || removedTxt) && (
                            <div className="text-xs text-zinc-600 mt-1">
                              {addonsTxt}{addonsTxt && removedTxt ? ' — ' : ''}{removedTxt}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {/* Stato lavorazione */}
                    {o.status !== 'pending' && (
                      <button
                        onClick={() => setStatus(o.id, 'pending')}
                        className="px-2 py-1 border rounded"
                      >
                        Torna a Nuovi
                      </button>
                    )}
                    {o.status !== 'preparing' && (
                      <button
                        onClick={() => setStatus(o.id, 'preparing')}
                        className="px-2 py-1 border rounded"
                      >
                        In preparazione
                      </button>
                    )}
                    {o.status !== 'done' && (
                      <button
                        onClick={() => setStatus(o.id, 'done')}
                        className="px-2 py-1 border rounded"
                      >
                        Fatto
                      </button>
                    )}

                    {/* Pagamento */}
                    <button
                      onClick={() => togglePaid(o.id, o.payment_status)}
                      className={`px-2 py-1 rounded ${o.payment_status === 'paid' ? 'bg-emerald-600 text-white' : 'border'}`}
                      title="Toggle pagato/non pagato"
                    >
                      {o.payment_status === 'paid' ? 'Pagato' : 'Non pagato'}
                    </button>

                    {/* Link rapido al menu pubblico */}
                    <a
                      href={`/t/${tenantSlug}`}
                      target="_blank"
                      className="ml-auto text-xs text-zinc-600 underline"
                    >
                      Apri menu pubblico
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
