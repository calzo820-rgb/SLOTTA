// src/app/api/stripe-connect/status/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getMyMembership } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const stripeSecret = process.env.STRIPE_SECRET_KEY

export async function GET() {
  try {
    if (!stripeSecret) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY mancante.' },
        { status: 500 },
      )
    }

    const mem = await getMyMembership()

    if (!mem) {
      return NextResponse.json(
        { error: 'Non autorizzato.' },
        { status: 401 },
      )
    }

    const stripe = new Stripe(stripeSecret)

    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .select(
        `
        id,
        stripe_connect_account_id,
        stripe_connect_details_submitted,
        stripe_connect_charges_enabled,
        stripe_connect_payouts_enabled,
        stripe_connect_disabled_reason,
        stripe_connect_requirements
      `,
      )
      .eq('id', mem.tenant_id)
      .maybeSingle()

    if (tenantErr) throw tenantErr

    if (!tenant) {
      return NextResponse.json(
        { error: 'Attività non trovata.' },
        { status: 404 },
      )
    }

    const accountId = tenant.stripe_connect_account_id as string | null

    if (!accountId) {
      return NextResponse.json({
        connected: false,
        details_submitted: false,
        charges_enabled: false,
        payouts_enabled: false,
        disabled_reason: null,
        requirements: null,
      })
    }

    const account = await stripe.accounts.retrieve(accountId)

    const payload = {
      stripe_connect_details_submitted: account.details_submitted ?? false,
      stripe_connect_charges_enabled: account.charges_enabled ?? false,
      stripe_connect_payouts_enabled: account.payouts_enabled ?? false,
      stripe_connect_disabled_reason:
        account.requirements?.disabled_reason ?? null,
      stripe_connect_requirements: account.requirements ?? null,
    }

    const { error: updateErr } = await supabaseAdmin
      .from('tenants')
      .update(payload)
      .eq('id', tenant.id)

    if (updateErr) throw updateErr

    return NextResponse.json({
      connected: true,
      account_id: account.id,
      details_submitted: payload.stripe_connect_details_submitted,
      charges_enabled: payload.stripe_connect_charges_enabled,
      payouts_enabled: payload.stripe_connect_payouts_enabled,
      disabled_reason: payload.stripe_connect_disabled_reason,
      requirements: payload.stripe_connect_requirements,
    })
  } catch (e: unknown) {
    // Log the raw error for debugging; avoid accessing arbitrary properties on unknown
    console.error('stripe-connect status error:', e)
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : 'Errore durante il controllo dello stato Stripe Connect.',
      },
      { status: 500 },
    )
  }
}