// src/app/api/service-checkout/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseServer } from '@/lib/supabaseServer'

const stripeSecret = process.env.STRIPE_SECRET_KEY

export async function POST(req: Request) {
  try {
    if (!stripeSecret) {
      return NextResponse.json({ error: 'STRIPE_SECRET_KEY mancante' }, { status: 500 })
    }

   const stripe = new Stripe(stripeSecret)

    const sb = supabaseServer() // ✅ ORA è davvero una funzione

    const body = await req.json()
    const { booking_id, success_url, cancel_url } = body || {}

    if (!booking_id || !success_url || !cancel_url) {
      return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
    }

    // 1) leggo booking + service per importo
    const { data: booking, error: bErr } = await sb
      .from('service_bookings')
      .select('id, tenant_id, service_id, customer_name, customer_email')
      .eq('id', booking_id)
      .single()

    if (bErr || !booking) {
      return NextResponse.json({ error: bErr?.message || 'Booking non trovato' }, { status: 404 })
    }

    const { data: service, error: sErr } = await sb
      .from('services')
      .select('id, name, price_cents')
      .eq('id', booking.service_id)
      .single()

    if (sErr || !service) {
      return NextResponse.json({ error: sErr?.message || 'Servizio non trovato' }, { status: 404 })
    }

    // 2) creo sessione stripe
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url,
      cancel_url,
      customer_email: booking.customer_email || undefined,
      metadata: {
        booking_id: booking.id,
        tenant_id: booking.tenant_id,
        service_id: booking.service_id,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: service.price_cents,
            product_data: { name: service.name },
          },
        },
      ],
    })

    // 3) salvo stripe_session_id nel booking (se hai la colonna)
    // Se NON hai queste colonne, commenta questo blocco.
    await sb
      .from('service_bookings')
      .update({
        stripe_session_id: session.id,
        payment_status: 'pending',
      })
      .eq('id', booking.id)

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    console.error('service-checkout error:', e)
    return NextResponse.json(
      { error: e?.message || 'Errore durante la creazione del pagamento' },
      { status: 500 },
    )
  }
}
