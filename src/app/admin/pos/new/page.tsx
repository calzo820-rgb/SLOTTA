'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Tenant = { id: string; name: string; slug: string; primary_color?: string | null }
type Product = { id: string; name: string; price_cents: number; is_active: boolean; position:number; ingredients?: string | null }
type Addon = { id: string; name: string; price_cents: number; is_active: boolean; position?: number }
type Slot = { start: string; remaining: number; prev_remaining: number; can_select: boolean; blocked?: boolean }

type CartLine = {
  product_id: string
  name: string
  base_price_cents: number
  qty: number
  addons: { id?: string; name: string; price_cents: number }[]
  removed: string[]
}

function euro(c:number){ return (c/100).toFixed(2) }
function hhmm(iso: string){ return new Date(iso).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }
function parseBaseIngredients(s?: string | null){
  if (!s) return [] as string[]
  // accetta "Pomodoro | Mozzarella" oppure "Pomodoro, Mozzarella"
  return s.split(/[\|\-,•·]/).map(t => t.trim()).filter(Boolean)
}

export default function PosNewOrder(){
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [color, setColor] = useState('#b91c1c')

  const [products, setProducts] = useState<Product[]>([])
  const [addons, setAddons] = useState<Addon[]>([])

  const [cart, setCart] = useState<CartLine[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string>('')

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [note, setNote] = useState('')
  const [markPaid, setMarkPaid] = useState(true)

  // --- modal modifica ---
  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<{ mode: 'new' | 'edit', index?: number, product?: Product, qty: number, selAddons: Set<string>, rem: Set<string> } | null>(null)

  // ===== LOAD =====
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('tenants').select('id,name,slug,primary_color').order('name')
      const list = (data || []) as Tenant[]
      setTenants(list)
      if (list[0]) {
        setTenantId(list[0].id)
        setTenantSlug(list[0].slug)
        setColor(list[0].primary_color || '#b91c1c')
      }
    })()
  }, [])

  useEffect(() => {
    (async () => {
      if (!tenantId) return
      // prodotti visibili
      const { data: prods } = await supabase
        .from('products')
        .select('id,name,price_cents,is_active,position,ingredients')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('position', { ascending: true })
      setProducts((prods || []) as Product[])

      // addons tenant
      const { data: adds } = await supabase
        .from('tenant_addons')
        .select('id,name,price_cents,is_active,position')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('position', { ascending: true })
      setAddons((adds || []) as Addon[])

      // reset vari
      setCart([])
      setSelectedSlot('')
      const t = tenants.find(t => t.id === tenantId)
      if (t) { setTenantSlug(t.slug); setColor(t.primary_color || '#b91c1c') }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  // ===== AVAILABILITY =====
  const qtyTotal = useMemo(()=> cart.reduce((s,l)=> s + l.qty, 0), [cart])

  // carica sempre gli slot anche con carrello vuoto (qty=1) per poterli bloccare/sbloccare
  useEffect(() => {
    (async () => {
      if (!tenantSlug) return
      const qtyForSlots = Math.max(qtyTotal, 1)
      const res = await fetch(`/api/availability?tenant=${tenantSlug}&qty=${qtyForSlots}`)
      const j = await res.json()
      const s: Slot[] = j.slots || []
      setSlots(s)
      if (!selectedSlot) {
        const first = s.find(x => x.can_select)
        if (first) setSelectedSlot(first.start)
      }
    })()
  }, [tenantSlug, qtyTotal]) // sempre, anche a carrello vuoto

  // ===== CART HELPERS =====
  function lineUnitPrice(l: CartLine){
    const add = l.addons.reduce((s,a)=> s + a.price_cents, 0)
    return l.base_price_cents + add
  }
  const total = useMemo(()=> cart.reduce((s,l)=> s + lineUnitPrice(l)*l.qty, 0), [cart])

  function inc(id: string){
    setCart(prev => prev.map(l => l.product_id === id ? { ...l, qty: l.qty+1 } : l))
  }
  function dec(id: string){
    setCart(prev => prev.map(l => l.product_id === id ? { ...l, qty: Math.max(0, l.qty-1) } : l).filter(l => l.qty > 0))
  }

  // ===== MODIFICA / AGGIUNTA PRODOTTO =====
  function openCustomize(p: Product){
    setEditing({
      mode: 'new',
      product: p,
      qty: 1,
      selAddons: new Set<string>(),
      rem: new Set<string>() // per default nessuna rimozione
    })
    setOpenModal(true)
  }

  function openEditLine(idx: number){
    const l = cart[idx]
    const p = products.find(x => x.id === l.product_id)
    if (!p) return
    setEditing({
      mode: 'edit',
      index: idx,
      product: p,
      qty: l.qty,
      selAddons: new Set<string>(l.addons.map(a => a.id || a.name)),
      rem: new Set<string>(l.removed)
    })
    setOpenModal(true)
  }

  function confirmCustomize(){
    if (!editing || !editing.product) return
    const p = editing.product
    const chosenAddons = addons.filter(a => editing.selAddons.has(a.id) || editing.selAddons.has(a.name))
    const removed = Array.from(editing.rem)
    const newLine: CartLine = {
      product_id: p.id,
      name: p.name,
      base_price_cents: p.price_cents,
      qty: editing.qty,
      addons: chosenAddons.map(a => ({ id: a.id, name: a.name, price_cents: a.price_cents })),
      removed
    }

    if (editing.mode === 'new') {
      setCart(prev => [...prev, newLine])
    } else {
      const idx = editing.index!
      setCart(prev => prev.map((l,i) => i===idx ? newLine : l))
    }
    setOpenModal(false)
    setEditing(null)
  }

  // ===== CREAZIONE ORDINE =====
  async function createOrder(){
    const qty = cart.reduce((s,l)=> s + l.qty, 0)
    if (qty <= 0) return alert('Aggiungi almeno 1 prodotto')
    if (!selectedSlot) return alert('Seleziona una fascia oraria')
    if (!customerName.trim()) return alert('Inserisci un nome')

    const payload = {
      tenantSlug,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      note,
      ready_by: selectedSlot,
      items: cart.map(l => ({
        product_id: l.product_id,
        qty: l.qty,
        price_cents: l.base_price_cents, // il server somma le addons
        addons: l.addons.map(a => ({ name: a.name, price_cents: a.price_cents })),
        removed: l.removed
      })),
      channel: 'pos',
      mark_paid: markPaid
    }

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const j = await res.json()
    if (!res.ok) return alert(j?.error || 'Errore creazione ordine')

    alert(`Ordine creato! Numero: ${j.order_number || j.order_id}`)
    setCart([]); setSelectedSlot(''); setCustomerName(''); setCustomerPhone(''); setNote('')
  }

  // ===== BLOCCO/SBLOCCO FASCE =====
  async function toggleBlock(slot: Slot){
    if (!tenantId) return
    const slotIso = slot.start
    if (slot.blocked) {
      await supabase.from('slot_blocks').delete().eq('tenant_id', tenantId).eq('slot_start', slotIso)
    } else {
      await supabase.from('slot_blocks').upsert({ tenant_id: tenantId, slot_start: slotIso, reason: 'bloccato da POS' })
    }
    // refresh indipendente dalla qty
    const res = await fetch(`/api/availability?tenant=${tenantSlug}&qty=${Math.max(qtyTotal,1)}`)
    const j = await res.json()
    setSlots(j.slots || [])
    // se ho bloccato lo slot selezionato, deselezionalo
    if (slotIso === selectedSlot && !j.slots.find((s:Slot)=>s.start===slotIso && s.can_select)) {
      setSelectedSlot('')
    }
  }

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto grid gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cassa — nuovo ordine</h1>
        <label className="flex items-center gap-2">
          <span className="text-sm">Locale</span>
          <select value={tenantId} onChange={e=>setTenantId(e.target.value)} className="border rounded px-3 py-2">
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
          </select>
        </label>
      </header>

      <section className="grid md:grid-cols-2 gap-6">
        {/* Prodotti */}
        <div className="border rounded p-3">
          <div className="font-semibold mb-2">Prodotti</div>
          <div className="grid grid-cols-2 gap-2">
            {products.map(p => (
              <div key={p.id} className="border rounded p-2">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-zinc-500 mb-2">€ {euro(p.price_cents)}</div>
                <div className="flex gap-2">
                  <button
                    onClick={()=>openCustomize(p)}
                    className="btn btn-outline"
                    style={{ borderColor: color }}
                  >
                    Modifica
                  </button>
                  <button
                    onClick={()=>setEditing({ mode:'new', product:p, qty:1, selAddons:new Set(), rem:new Set() }) || setOpenModal(true)}
                    className="btn text-white"
                    style={{ background: color }}
                    title="Aggiungi veloce (puoi modificare nella riga del carrello)"
                  >
                    Aggiungi
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Carrello + orari + conferma */}
        <div className="border rounded p-3 grid gap-3">
          <div>
            <div className="font-semibold mb-1">Carrello</div>
            {cart.length === 0 ? (
              <div className="text-sm text-zinc-500">Nessun prodotto</div>
            ) : (
              <ul className="grid gap-2">
                {cart.map((l, idx) => {
                  const unit = lineUnitPrice(l)
                  return (
                    <li key={l.product_id+'-'+idx} className="border rounded px-2 py-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-sm text-zinc-600">€ {euro(unit)} x {l.qty} = <strong>€ {euro(unit*l.qty)}</strong></div>
                      </div>
                      {(l.addons.length>0 || l.removed.length>0) && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {l.addons.map((a,i)=>(<span key={'a'+i} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">+ {a.name}</span>))}
                          {l.removed.map((r,i)=>(<span key={'r'+i} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">− {r}</span>))}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <button className="btn btn-outline btn-sm" style={{ borderColor: color }} onClick={()=>dec(l.product_id)}>-</button>
                        <div className="w-6 text-center">{l.qty}</div>
                        <button className="btn btn-outline btn-sm" style={{ borderColor: color }} onClick={()=>inc(l.product_id)}>+</button>
                        <button className="btn btn-outline btn-sm ml-2" style={{ borderColor: color }} onClick={()=>openEditLine(idx)}>Modifica</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div>
            <div className="font-semibold mb-1">Fascia di ritiro</div>
            <div className="flex flex-wrap gap-2">
  {slots
    .filter(s => s && (s.iso || s.start))            // evita elementi “vuoti”
    .map((s, i) => (
      <button
        key={`bl-${s.iso ?? s.start ?? i}`}           // <-- key sempre unica
        onClick={() => toggleBlock(s)}
        className={`btn btn-sm ${s.blocked ? 'text-white' : 'btn-outline'}`}
        style={{
          background: s.blocked ? '#ef4444' : 'transparent',
          borderColor: s.blocked ? '#ef4444' : undefined,
          opacity: 1,
        }}
      >
        {s.label ?? s.start ?? '—'}
      </button>
  ))}
</div>

            <div className="text-xs text-zinc-500 mt-1">
              Le fasce disattivate non sono prenotabili anche online.
            </div>
          </div>

          <div className="grid gap-2">
            <input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Nome" className="border rounded px-3 py-2" />
            <input value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="Telefono (opz.)" className="border rounded px-3 py-2" />
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Note" className="border rounded px-3 py-2" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={markPaid} onChange={e=>setMarkPaid(e.target.checked)} />
              Segna pagato
            </label>
            <div className="font-semibold">Totale: € {euro(total)}</div>
            <button onClick={createOrder} className="btn text-white" style={{ background: color }}>
              Crea ordine POS
            </button>
          </div>
        </div>
      </section>

      {/* Gestione fasce (blocca/sblocca) */}
      <section className="border rounded p-3">
        <div className="font-semibold mb-2">Gestione fasce di oggi</div>
        <div className="flex flex-wrap gap-2">
  {slots
    .filter(s => s && (s.iso || s.start))                 // evita elementi senza start/iso
    .map((s, i) => (
      <button
        key={`bl-${s.iso ?? s.start ?? i}`}               // <-- key sempre unica
        onClick={() => toggleBlock(s)}
        className={`btn btn-sm ${s.blocked ? 'text-white' : 'btn-outline'}`}
        style={{ background: s.blocked ? '#ef4444' : 'transparent' }}
      >
        {s.label ?? s.start ?? '—'}
      </button>
  ))}
</div>
        <div className="text-xs text-zinc-500 mt-1">
          Queste impostazioni valgono anche per gli ordini online.
        </div>
      </section>

      {/* MODAL MODIFICA */}
      {openModal && editing?.product && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 w-[min(96vw,560px)]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold">Modifica — {editing.product.name}</div>
              <button className="btn btn-outline btn-sm" style={{ borderColor: color }} onClick={()=>{ setOpenModal(false); setEditing(null) }}>Chiudi</button>
            </div>

            <div className="grid gap-3">
              {/* quantità */}
              <div className="flex items-center gap-2">
                <span className="text-sm">Quantità</span>
                <button className="btn btn-outline btn-sm" style={{ borderColor: color }} onClick={()=> setEditing(e => e && ({...e, qty: Math.max(1, e.qty-1)}))}>-</button>
                <div className="w-8 text-center">{editing.qty}</div>
                <button className="btn btn-outline btn-sm" style={{ borderColor: color }} onClick={()=> setEditing(e => e && ({...e, qty: e.qty+1}))}>+</button>
              </div>

              {/* rimozioni dagli ingredienti base */}
              <div>
                <div className="font-medium">Rimuovi ingredienti</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {parseBaseIngredients(editing.product.ingredients).map((ing) => {
                    const on = editing.rem.has(ing)
                    return (
                      <button
                        key={ing}
                        onClick={()=> setEditing(e => {
                          if (!e) return e
                          const copy = new Set(e.rem)
                          on ? copy.delete(ing) : copy.add(ing)
                          return { ...e, rem: copy }
                        })}
                        className={`btn btn-sm ${on ? 'text-white' : 'btn-outline'}`}
                        style={{ background: on ? '#ef4444' : 'transparent', borderColor: on ? '#ef4444' : color }}
                      >
                        {on ? '− ' : ''}{ing}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* aggiunte */}
              <div>
                <div className="font-medium">Aggiunte</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {addons.map(a => {
                    const on = editing.selAddons.has(a.id) || editing.selAddons.has(a.name)
                    return (
                      <button
                        key={a.id}
                        onClick={()=> setEditing(e => {
                          if (!e) return e
                          const copy = new Set(e.selAddons)
                          on ? copy.delete(a.id) : copy.add(a.id)
                          return { ...e, selAddons: copy }
                        })}
                        className={`btn btn-sm ${on ? 'text-white' : 'btn-outline'}`}
                        style={{ background: on ? '#16a34a' : 'transparent', borderColor: on ? '#16a34a' : color }}
                        title={`€ ${euro(a.price_cents)}`}
                      >
                        + {a.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button className="btn btn-outline" style={{ borderColor: color }} onClick={()=>{ setOpenModal(false); setEditing(null) }}>
                  Annulla
                </button>
                <button className="btn text-white" style={{ background: color }} onClick={confirmCustomize}>
                  Conferma
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
