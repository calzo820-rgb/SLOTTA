// src/app/api/stripe-connect/status/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getMyMembership } from '@/lib/authz'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

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

    const { data: tenant, error: tenantErr } = await getSupabaseAdmin()
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
      const { data: settings, error: settingsError } = await getSupabaseAdmin()
        .from('tenant_settings')
        .select('online_payments_reactivation_required')
        .eq('tenant_id', tenant.id)
        .maybeSingle()
      if (settingsError) throw settingsError

      return NextResponse.json({
        connected: false,
        stripe_ready: false,
        reactivation_required:
          settings?.online_payments_reactivation_required === true,
        details_submitted: false,
        charges_enabled: false,
        payouts_enabled: false,
      })
    }

    const observedAt = new Date().toISOString()
    let account: Stripe.Account
    try {
      account = await stripe.accounts.retrieve(accountId)
    } catch {
      const { data: settings } = await getSupabaseAdmin()
        .from('tenant_settings')
        .select('online_payments_reactivation_required')
        .eq('tenant_id', tenant.id)
        .maybeSingle()

      return NextResponse.json(
        {
          error: 'Verifica temporaneamente non disponibile. Riprova tra poco.',
          error_code: 'STRIPE_STATUS_UNAVAILABLE',
          temporarily_unavailable: true,
          connected: true,
          stripe_ready: null,
          reactivation_required:
            settings?.online_payments_reactivation_required === true,
        },
        { status: 503 },
      )
    }

    const payload = {
      stripe_connect_details_submitted: account.details_submitted ?? false,
      stripe_connect_charges_enabled: account.charges_enabled ?? false,
      stripe_connect_payouts_enabled: account.payouts_enabled ?? false,
      stripe_connect_disabled_reason:
        account.requirements?.disabled_reason ?? null,
      stripe_connect_requirements: account.requirements ?? null,
    }

    const { data: syncedStripeReady, error: updateErr } = await getSupabaseAdmin().rpc(
      'sync_stripe_connect_account_status',
      {
        p_stripe_account_id: accountId,
        p_details_submitted: payload.stripe_connect_details_submitted,
        p_charges_enabled: payload.stripe_connect_charges_enabled,
        p_payouts_enabled: payload.stripe_connect_payouts_enabled,
        p_disabled_reason: payload.stripe_connect_disabled_reason,
        p_requirements: payload.stripe_connect_requirements,
        p_observed_at: observedAt,
      },
    )

    if (updateErr) throw updateErr

    const { data: settings, error: settingsError } = await getSupabaseAdmin()
      .from('tenant_settings')
      .select('online_payments_reactivation_required')
      .eq('tenant_id', tenant.id)
      .maybeSingle()

    if (settingsError) throw settingsError

    const stripeReady = syncedStripeReady === true &&
      payload.stripe_connect_charges_enabled &&
      payload.stripe_connect_payouts_enabled

    return NextResponse.json({
      connected: true,
      stripe_ready: stripeReady,
      reactivation_required:
        settings?.online_payments_reactivation_required === true,
      details_submitted: payload.stripe_connect_details_submitted,
      charges_enabled: payload.stripe_connect_charges_enabled,
      payouts_enabled: payload.stripe_connect_payouts_enabled,
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
