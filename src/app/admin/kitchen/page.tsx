'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Tenant = { id: string; name: string; slug: string; primary_color?: string | null }
type OrderItem = { id: string; qty: number; addons?: any[]; removed?: any[]; product?: { name: string } | null }
type Order = {
  id: string
  tenant_id: string
  order_number?: string | null
  customer_name: string
  note?: string | null
  status: 'pending' | 'preparing' | 'done' | 'picked_up'
  payment_status: 'unpaid' | 'paid'
  total_cents: number
  created_at: string
  ready_by?: string | null
}

function fmtTime(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function KitchenPage(){
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')
  const [color, setColor] = useState('#111827')
  const [orders, setOrders] = useState<Order[]>([])
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>({})
  const [loading, setLoading] = useState(false)

  // beep leggero su nuovi pending
  const seenPendingRef = useRef<Set<string>>(new Set())
  function beep(){
    try{
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = 880; g.gain.value = 0.06
      o.start(); setTimeout(()=>{ o.stop(); ctx.close() }, 160)
    }catch{}
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('tenants').select('id,name,slug,primary_color').order('name')
      const list = (data || []) as Tenant[]
      setTenants(list)
      if (list[0]) {
        setTenantId(list[0].id)
        setColor(list[0].primary_color || '#b91c1c')
      }
    })()
  }, [])

  useEffect(() => {
    if (!tenantId) return
    loadToday()
    const t = tenants.find(x => x.id === tenantId)
    if (t?.primary_color) setColor(t.primary_color)

    const ch = supabase
      .channel('kitchen-orders')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          loadToday(true)
          if (payload.eventType === 'INSERT') {
            const rec = payload.new as any
            if (rec.status === 'pending' && !seenPendingRef.current.has(rec.id)) {
              seenPendingRef.current.add(rec.id)
              beep()
            }
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function loadToday(silent=false){
    if (!silent) setLoading(true)
    const start = new Date(); start.setHours(0,0,0,0)
    const end = new Date(); end.setHours(23,59,59,999)

const { data } = await supabase
  .from('orders')
  .select('id,tenant_id,order_number,customer_name,note,status,payment_status,total_cents,created_at,ready_by')
  .eq('tenant_id', tenantId)
  .gte('created_at', start.toISOString())
  .lte('created_at', end.toISOString())
  // 👇 mostra solo quelli da lavorare in cucina
  .in('status', ['pending', 'preparing'])
  .order('ready_by', { ascending: true, nullsFirst: false })
  .order('created_at', { ascending: true })

    const list = (data || []) as Order[]
    setOrders(list)

    if (list.length) {
      const ids = list.map(o => o.id)
      const { data: rows } = await supabase
        .from('order_items')
        .select('id, order_id, qty, addons, removed, product:products(name)')
        .in('order_id', ids)
      const map: Record<string, OrderItem[]> = {}
      ;(rows || []).forEach((r: any) => {
        (map[r.order_id] ||= []).push(r as OrderItem)
      })
      setItemsByOrder(map)
    } else {
      setItemsByOrder({})
    }
    if (!silent) setLoading(false)
  }

 async function setStatus(id: string, status: Order['status']){
  const { error } = await supabase.from('orders').update({ status }).eq('id', id)
  if (error) { alert(error.message); return }
  // 👇 sparisce subito dalla lista cucina
  if (status === 'done') {
    setOrders(prev => prev.filter(o => o.id !== id))
  }
}


  const view = useMemo(() => orders, [orders])

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto grid gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Cucina — ordini di oggi</h1>
        <label className="flex items-center gap-2">
          <span className="text-sm">Locale</span>
          <select
            value={tenantId}
            onChange={e=>setTenantId(e.target.value)}
            className="border rounded px-3 py-2"
          >
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
          </select>
        </label>
      </header>

      {loading && <div className="text-sm text-zinc-500">Caricamento…</div>}

      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {view.map(o => {
          const lines = itemsByOrder[o.id] || []
          return (
            <article key={o.id} className="rounded-xl border p-4 bg-white">
              {/* Testata: orario + numero ordine */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-zinc-500 leading-none">Ritiro</div>
                  <div className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">
                    {fmtTime(o.ready_by)}
                  </div>
                  <div className="text-sm text-zinc-700 mt-1">{o.customer_name}</div>
                </div>
                {o.order_number && (
                  <div
                    className="text-base md:text-lg font-bold px-3 py-1 rounded-lg"
                    style={{ border: `2px solid ${color}`, color }}
                  >
                    #{o.order_number}
                  </div>
                )}
              </div>

              {o.note && (
                <div className="mt-3 text-sm bg-yellow-50 border border-yellow-200 rounded p-2">
                  <span className="font-medium">Nota:</span> {o.note}
                </div>
              )}

              {/* Righe ordine */}
              <ul className="mt-4 grid gap-2">
                {lines.map(li => {
                  const addons = (li.addons as any[]) || []
                  const removed = (li.removed as any[]) || []
                  return (
                    <li key={li.id} className="border rounded-lg p-3">
                      {/* Prodotto × qty grande */}
                      <div className="flex items-center justify-between">
                        <div className="text-lg md:text-xl font-semibold">
                          {li.product?.name || 'Prodotto'}
                        </div>
                        <div
                          className="text-lg md:text-xl font-extrabold px-2 py-0.5 rounded"
                          style={{ border: `1px solid ${color}`, color }}
                          title="Quantità"
                        >
                          × {li.qty}
                        </div>
                      </div>

                      {/* Aggiunte / Rimozioni come badge */}
                      {(addons.length > 0 || removed.length > 0) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {addons.map((a: any, i: number) => (
                            <span key={`add-${i}`} className="text-xs md:text-sm px-2 py-1 rounded-full bg-green-100 text-green-800 border border-green-300">
                              + {a.name || a}
                            </span>
                          ))}
                          {removed.map((r: any, i: number) => (
                            <span key={`rem-${i}`} className="text-xs md:text-sm px-2 py-1 rounded-full bg-red-100 text-red-800 border border-red-300">
                              − {r.name || r}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>

              {/* Stato / Azioni */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm md:text-base text-zinc-600">
                  Stato: <span className="font-semibold">{o.status}</span>
                </div>
                <div className="flex gap-2">
                  {o.status === 'pending' && (
                    <button
                      onClick={()=>setStatus(o.id,'preparing')}
                      className="btn btn-outline"
                      style={{ borderColor: color }}
                    >
                      In prepara
                    </button>
                  )}
                  {o.status === 'preparing' && (
                    <button
                      onClick={()=>setStatus(o.id,'done')}
                      className="btn text-white"
                      style={{ background: color }}
                    >
                      Pronto
                    </button>
                  )}
                  {o.status === 'done' && (
                    <span className="text-xs md:text-sm px-2 py-1 rounded border"
                          style={{ borderColor: color, color }}>
                      Pronto
                    </span>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}
