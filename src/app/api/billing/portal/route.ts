import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getMyMembership } from '@/lib/authz'
import { canUseBillingPortal } from '@/lib/billing'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const membership = await getMyMembership()
  if (!membership) return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 })
  if (membership.role !== 'owner') return NextResponse.json({ error: 'Accesso riservato al proprietario.' }, { status: 403 })
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Stripe non configurato.' }, { status: 503 })

  const { data } = await getSupabaseAdmin().from('tenants').select('billing_customer_id').eq('id', membership.tenant_id).maybeSingle()
  if (!canUseBillingPortal(data?.billing_customer_id)) return NextResponse.json({ error: 'Nessun abbonamento da gestire.' }, { status: 409 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const session = await stripe.billingPortal.sessions.create({
    customer: data!.billing_customer_id as string,
    return_url: `${new URL(req.url).origin}/admin/billing`,
  })
  return NextResponse.json({ url: session.url })
}
