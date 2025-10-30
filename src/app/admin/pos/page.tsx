'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Tenant = { id: string; name: string; slug: string; primary_color?: string | null }
type Order = {
  id: string
  tenant_id: string
  order_number?: string | null
  customer_name: string
  customer_phone?: string | null
  status: 'pending' | 'preparing' | 'done' | 'picked_up'
  payment_status: 'unpaid' | 'paid'
  total_cents: number
  created_at: string
  ready_by?: string | null
}

function euro(cents: number){ return (cents/100).toFixed(2) }
function fmtTime(iso?: string | null){ return iso ? new Date(iso).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—' }

export default function PosPage(){
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')
  const [color, setColor] = useState('#111827')
  const [orders, setOrders] = useState<Order[]>([])
  const [query, setQuery] = useState('')

  // 👇 mappa: order_id -> somma qty righe
  const [qtyByOrder, setQtyByOrder] = useState<Record<string, number>>({})
  // 👇 contatore giornaliero “pizze fatte” (done + picked_up)
  const [madeToday, setMadeToday] = useState(0)

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
      .channel('pos-orders')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
        () => loadToday(true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function loadToday(silent=false){
    const start = new Date(); start.setHours(0,0,0,0)
    const end = new Date(); end.setHours(23,59,59,999)

    // ordini di oggi (tutti, per la cassa)
    const { data } = await supabase
      .from('orders')
      .select('id,tenant_id,order_number,customer_name,customer_phone,status,payment_status,total_cents,created_at,ready_by')
      .eq('tenant_id', tenantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('ready_by', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    const list = (data || []) as Order[]
    setOrders(list)

    // carica quantity per ordini visibili in tabella
    if (list.length) {
      const ids = list.map(o => o.id)
      const { data: rows } = await supabase
        .from('order_items')
        .select('order_id, qty')
        .in('order_id', ids)
      const map: Record<string, number> = {}
      ;(rows || []).forEach((r: any) => {
        map[r.order_id] = (map[r.order_id] || 0) + (r.qty || 0)
      })
      setQtyByOrder(map)
    } else {
      setQtyByOrder({})
    }

    // contatore giornaliero “pizze fatte”: done + picked_up
    const { data: doneOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .in('status', ['done', 'picked_up'])
    if ((doneOrders || []).length > 0) {
      const doneIds = (doneOrders || []).map(o => o.id)
      const { data: doneRows } = await supabase
        .from('order_items')
        .select('qty')
        .in('order_id', doneIds)
      const totalDone = (doneRows || []).reduce((s, r: any) => s + (r.qty || 0), 0)
      setMadeToday(totalDone)
    } else {
      setMadeToday(0)
    }
  }

  async function setPaid(id: string){
    await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', id)
  }
  async function setPicked(id: string){
    await supabase.from('orders').update({ status: 'picked_up' }).eq('id', id)
    // opzionale: aggiorna contatore locale se la riga è già “done”
    const added = qtyByOrder[id] || 0
    setMadeToday(prev => prev + added)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return orders
    return orders.filter(o =>
      (o.order_number || '').toLowerCase().includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.customer_phone || '').toLowerCase().includes(q)
    )
  }, [orders, query])

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Cassa / Ritiro</h1>
        <div className="flex items-center gap-3">
          {/* badge contatore pizze fatte oggi */}
          <div className="px-3 py-1 rounded border bg-white text-sm">
            <span className="text-zinc-600">Pizze fatte oggi:</span>{' '}
            <span className="font-bold">{madeToday}</span>
          </div>

          <input
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="Cerca n. ordine, nome, telefono…"
            className="border rounded px-3 py-2 w-72"
          />
          <select
            value={tenantId}
            onChange={e=>setTenantId(e.target.value)}
            className="border rounded px-3 py-2"
          >
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
          </select>
        </div>
      </header>

      <table className="w-full border rounded overflow-hidden bg-white">
<thead className="bg-zinc-50 text-left text-sm">
  <tr>
    <th className="p-2 border-b">Orario</th>
    <th className="p-2 border-b">N. Ordine</th>
    <th className="p-2 border-b" aria-label="Numero pizze nell'ordine">🍕</th>
    <th className="p-2 border-b">Cliente</th>
    <th className="p-2 border-b">Telefono</th>
    <th className="p-2 border-b">Totale</th>
    <th className="p-2 border-b">Pagamento</th>
    <th className="p-2 border-b">Stato</th>
    <th className="p-2 border-b text-right">Azioni</th>
  </tr>
</thead>
        <tbody>
          {filtered.map(o => (
            <tr key={o.id} className="border-b">
              <td className="p-2">{fmtTime(o.ready_by)}</td>
              <td className="p-2 font-semibold">{o.order_number || '—'}</td>
              <td className="p-2 font-semibold text-center">{qtyByOrder[o.id] ?? '—'}</td>
              <td className="p-2">{o.customer_name}</td>
              <td className="p-2">{o.customer_phone || '—'}</td>
              <td className="p-2">€ {euro(o.total_cents)}</td>
              <td className="p-2">{o.payment_status === 'paid' ? 'Pagato' : 'Da pagare'}</td>
              <td className="p-2">{o.status}</td>
              <td className="p-2">
                <div className="flex justify-end gap-2">
                  {o.payment_status !== 'paid' && (
                    <button onClick={()=>setPaid(o.id)} className="btn btn-outline btn-sm" style={{ borderColor: color }}>Segna pagato</button>
                  )}
                  {o.status !== 'picked_up' && (
                    <button onClick={()=>setPicked(o.id)} className="btn text-white btn-sm" style={{ background: color }}>Ritirato</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={9} className="p-4 text-center text-sm text-zinc-600">Nessun ordine</td></tr>
          )}
        </tbody>
      </table>
    </main>
  )
}
