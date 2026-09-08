import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getMyMembership } from '@/lib/authz'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const membership = await getMyMembership()
  if (!membership) return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 })
  if (membership.role !== 'owner') return NextResponse.json({ error: 'Accesso riservato al proprietario.' }, { status: 403 })

  const secret = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_BILLING_PRICE_ID
  if (!secret || !priceId) return NextResponse.json({ error: 'Abbonamenti non ancora configurati.' }, { status: 503 })

  const db = getSupabaseAdmin()
  const { data: tenant, error } = await db.from('tenants')
    .select('id, name, contact_email, billing_customer_id, billing_subscription_id')
    .eq('id', membership.tenant_id).maybeSingle()
  if (error || !tenant) return NextResponse.json({ error: 'Attività non trovata.' }, { status: 404 })
  if (tenant.billing_subscription_id) return NextResponse.json({ error: 'Esiste già un abbonamento. Usa il portale di gestione.' }, { status: 409 })

  const stripe = new Stripe(secret)
  let customerId = tenant.billing_customer_id as string | null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: tenant.contact_email || undefined,
      name: tenant.name || undefined,
      metadata: { tenant_id: tenant.id },
    })
    customerId = customer.id
    const { error: updateError } = await db.from('tenants').update({ billing_customer_id: customerId }).eq('id', tenant.id)
    if (updateError) return NextResponse.json({ error: 'Impossibile preparare l’abbonamento.' }, { status: 500 })
  }

  const origin = new URL(req.url).origin
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${origin}/admin/billing?checkout=success`,
    cancel_url: `${origin}/admin/billing?checkout=cancelled`,
    metadata: { tenant_id: tenant.id, purpose: 'slotta_subscription' },
    subscription_data: { metadata: { tenant_id: tenant.id, purpose: 'slotta_subscription' } },
  })

  return NextResponse.json({ url: session.url })
}
