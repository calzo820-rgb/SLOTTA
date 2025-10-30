// src/app/api/orders/route.ts
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { notifyNewOrder } from '@/lib/notifier'

const SLOT_MINUTES = 10
const CAPACITY_PER_SLOT = 5

type IncomingItem = {
  product_id: string
  qty: number
  price_cents: number
  addons?: { name: string; price_cents: number }[]
  removed?: string[]
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      tenantSlug: string
      customer_name: string
      customer_phone?: string
      note?: string
      ready_by: string       // ISO slot selezionato
      items: IncomingItem[]
    }

    if (!body?.tenantSlug) return NextResponse.json({ error: 'tenantSlug mancante' }, { status: 400 })
    if (!body?.customer_name) return NextResponse.json({ error: 'Nome cliente mancante' }, { status: 400 })
    if (!body?.ready_by) return NextResponse.json({ error: 'Orario di ritiro mancante' }, { status: 400 })
    if (!body?.items?.length) return NextResponse.json({ error: 'Nessuna riga ordine' }, { status: 400 })

    const supa = supabaseServer()

    // Tenant + settings (per email)
    const { data: tenants } = await supa.from('tenants').select('id, slug, name').eq('slug', body.tenantSlug).limit(1)
    const tenant = tenants?.[0] as { id: string; slug: string; name: string } | undefined
    if (!tenant) return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 })

    const { data: settings } = await supa
      .from('tenant_settings')
      .select('contact_email')
      .eq('tenant_id', tenant.id)
      .single()

    // Quantità e totale
    const total_qty = body.items.reduce((s, it) => s + Math.max(0, it.qty || 0), 0)
    if (total_qty <= 0) return NextResponse.json({ error: 'Quantità totale non valida' }, { status: 400 })

    const total_cents = body.items.reduce((sum, it) => {
      const addonsSum = (it.addons || []).reduce((a, ad) => a + (ad.price_cents || 0), 0)
      return sum + ((it.price_cents || 0) + addonsSum) * (it.qty || 0)
    }, 0)

    // Slot corrente + precedente
    const start = new Date(body.ready_by); start.setSeconds(0, 0)
    const prev = new Date(start.getTime() - SLOT_MINUTES * 60 * 1000)
    const prevIso = prev.toISOString()
    const startIso = start.toISOString()

    const { data: pair } = await supa
      .from('order_slot_allocations')
      .select('slot_start, qty')
      .eq('tenant_id', tenant.id)
      .in('slot_start', [prevIso, startIso])

    const map = new Map<number, number>()
    ;(pair || []).forEach(a => map.set(new Date(a.slot_start as string).getTime(), a.qty || 0))

    const currAllocated = map.get(start.getTime()) || 0
    const prevAllocated = map.get(prev.getTime()) || 0
    const currRemaining = Math.max(0, CAPACITY_PER_SLOT - currAllocated)
    const prevRemaining = Math.max(0, CAPACITY_PER_SLOT - prevAllocated)

    if (!(currRemaining >= total_qty || (prevRemaining + currRemaining) >= total_qty)) {
      return NextResponse.json({ error: 'Fascia non disponibile', code: 'NO_CAPACITY' }, { status: 409 })
    }

    // Piano allocazione (max 2 slot)
    let toAllocate = total_qty
    const plan: { slot_start: Date; qty: number }[] = []

    if (prevRemaining > 0 && (prevRemaining + currRemaining) >= total_qty && currRemaining < total_qty) {
      const usePrev = Math.min(prevRemaining, toAllocate - currRemaining)
      if (usePrev > 0) { plan.push({ slot_start: prev, qty: usePrev }); toAllocate -= usePrev }
    }
    if (toAllocate > 0) {
      const useCurr = Math.min(currRemaining, toAllocate)
      if (useCurr > 0) { plan.push({ slot_start: start, qty: useCurr }); toAllocate -= useCurr }
    }
    if (toAllocate > 0) {
      return NextResponse.json({ error: 'Capienza insufficiente' }, { status: 409 })
    }

    // Numero ordine univoco per tenant/giorno
    const { data: numRes, error: numErr } = await supa.rpc('next_order_number', { p_tenant: tenant.id })
    if (numErr) return NextResponse.json({ error: 'Errore numero ordine: ' + numErr.message }, { status: 500 })
    const order_number = String(numRes)

    // Crea ordine
   // canale e pagamento da POS o online
const channel = (body as any).channel === 'pos' ? 'pos' : 'online'
const mark_paid = !!(body as any).mark_paid

const { data: order, error: oerr } = await supa
  .from('orders')
  .insert({
    tenant_id: tenant.id,
    customer_name: body.customer_name,
    customer_phone: body.customer_phone || '',
    note: body.note || '',
    status: 'pending',
    total_cents,
    payment_status: mark_paid ? 'paid' : 'unpaid',
    ready_by: startIso,
    order_number,
    channel, // 👈 nuovo campo che distingue POS / ONLINE
  })
  .select('id, order_number, ready_by')
  .single()

    if (oerr || !order) return NextResponse.json({ error: oerr?.message || 'Errore creazione ordine' }, { status: 500 })

    // Righe ordine
    const rows = body.items.map(it => ({
      order_id: order.id,
      product_id: it.product_id,
      qty: it.qty,
      price_cents: it.price_cents,
      addons: it.addons || [],
      removed: it.removed || []
    }))
    const { error: ierr } = await supa.from('order_items').insert(rows)
    if (ierr) return NextResponse.json({ error: 'Errore righe ordine', detail: ierr.message }, { status: 500 })

    // Allocazioni slot
    const allocRows = plan.map(p => ({
      tenant_id: tenant.id,
      order_id: order.id,
      slot_start: p.slot_start.toISOString(),
      qty: p.qty
    }))
    const { error: aerr } = await supa.from('order_slot_allocations').insert(allocRows)
    if (aerr) return NextResponse.json({ error: 'Errore allocazione slot', detail: aerr.message }, { status: 500 })

    // Notifica via email (se configurata)
    try {
      await notifyNewOrder({
        toEmail: settings?.contact_email || null,
        tenantName: tenant.name,
        orderNumber: order.order_number!,
        totalCents: total_cents,
        readyByIso: order.ready_by!,
        items: body.items.map(it => ({
          name: '', // opzionale: potresti mappare id->nome prodotto se vuoi
          qty: it.qty,
          addons: (it.addons || []).map(a => a.name),
          removed: it.removed || []
        }))
      })
    } catch (e) {
      console.warn('[notifyNewOrder] failed', e)
    }

    return NextResponse.json({ ok: true, order_id: order.id, order_number: order.order_number })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Errore' }, { status: 500 })
  }
}
