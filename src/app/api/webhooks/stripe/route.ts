import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature') as string
  const buf = Buffer.from(await req.arrayBuffer())

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any })
    const event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const orderId = session.metadata?.order_id
      if (orderId) {
        const supa = supabaseServer()
        await supa.from('orders').update({ payment_status: 'paid', status: 'preparing' }).eq('id', orderId)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }
}
