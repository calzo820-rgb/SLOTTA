// src/app/api/stripe-connect/onboarding/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getMyMembership } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const stripeSecret = process.env.STRIPE_SECRET_KEY

export async function POST(req: Request) {
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

    if (mem.role !== 'owner') {
      return NextResponse.json(
        { error: 'Solo il titolare può attivare i pagamenti online.' },
        { status: 403 },
      )
    }

    const stripe = new Stripe(stripeSecret)

    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .select(
        `
        id,
        name,
        contact_email,
        stripe_connect_account_id
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

    let accountId = tenant.stripe_connect_account_id as string | null

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'IT',
        email: tenant.contact_email || undefined,
        business_profile: {
          name: tenant.name || undefined,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })

      accountId = account.id

      const { error: updateErr } = await supabaseAdmin
        .from('tenants')
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_onboarding_started_at: new Date().toISOString(),
          stripe_connect_details_submitted: account.details_submitted ?? false,
          stripe_connect_charges_enabled: account.charges_enabled ?? false,
          stripe_connect_payouts_enabled: account.payouts_enabled ?? false,
          stripe_connect_disabled_reason:
            account.requirements?.disabled_reason ?? null,
          stripe_connect_requirements: account.requirements ?? null,
        })
        .eq('id', tenant.id)

      if (updateErr) throw updateErr
    }

    const origin = new URL(req.url).origin

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim()
        ? process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, '')
        : origin

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/admin/profile?stripe_connect=refresh`,
      return_url: `${siteUrl}/admin/profile?stripe_connect=return`,
      type: 'account_onboarding',
    })

    return NextResponse.json({
      url: accountLink.url,
    })
  } catch (e: unknown) {
    // Log the raw error for debugging
    console.error('stripe-connect onboarding error:', e)
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : 'Errore durante la creazione del collegamento Stripe Connect.',
      },
      { status: 500 },
    )
  }
}