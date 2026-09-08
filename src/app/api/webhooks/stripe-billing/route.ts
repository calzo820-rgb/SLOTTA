import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { logApiEvent, observeApiRoute } from '@/lib/apiObservability'
import { normalizeBillingStatus, stripeReferenceId, subscriptionPeriodEnd } from '@/lib/billing'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function updateByCustomer(customerId: string, values: Record<string, unknown>) {
  const { error } = await getSupabaseAdmin().from('tenants').update(values).eq('billing_customer_id', customerId)
  if (error) throw error
}

async function syncSubscription(stripe: Stripe, reference: unknown) {
  const subscriptionId = stripeReferenceId(reference, 'sub_')
  if (!subscriptionId) return false
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const customerId = stripeReferenceId(subscription.customer, 'cus_')
  if (!customerId) return false

  await updateByCustomer(customerId, {
    billing_subscription_id: subscription.id,
    billing_status: normalizeBillingStatus(subscription.status),
    billing_current_period_end: subscriptionPeriodEnd(subscription),
    billing_grace_ends_at: subscription.status === 'past_due'
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null,
  })
  return true
}

async function handlePost(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET
  if (!secretKey || !webhookSecret) return NextResponse.json({ error: 'Configurazione billing mancante.' }, { status: 503 })

  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Firma mancante.' }, { status: 400 })

  const stripe = new Stripe(secretKey)
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(Buffer.from(await req.arrayBuffer()), signature, webhookSecret)
  } catch {
    logApiEvent('stripe_billing_signature_invalid')
    return NextResponse.json({ error: 'Firma non valida.' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.metadata?.purpose === 'slotta_subscription') await syncSubscription(stripe, session.subscription)
    } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await syncSubscription(stripe, event.data.object)
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = stripeReferenceId(invoice.customer, 'cus_')
      if (customerId) await updateByCustomer(customerId, {
        billing_status: 'past_due',
        billing_grace_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    } else if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = stripeReferenceId(invoice.customer, 'cus_')
      if (customerId) await updateByCustomer(customerId, { billing_status: 'active', billing_grace_ends_at: null })
    }

    logApiEvent('stripe_billing_event_processed', 'info')
    return NextResponse.json({ received: true })
  } catch {
    logApiEvent('stripe_billing_event_failed', 'error')
    return NextResponse.json({ error: 'Elaborazione temporaneamente non disponibile.' }, { status: 500 })
  }
}

export const POST = observeApiRoute('/api/webhooks/stripe-billing', handlePost)
