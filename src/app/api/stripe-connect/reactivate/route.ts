import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { enforceDistributedRateLimit, readJsonBody } from '@/lib/apiGuard'
import { getMyMembership } from '@/lib/authz'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import type { PaymentModeDefault } from '@/lib/stripeConnectPayments'

const stripeSecret = process.env.STRIPE_SECRET_KEY

const paymentModes = new Set<PaymentModeDefault>([
  'online',
  'in_person',
  'client_choice',
])

export async function POST(req: Request) {
  try {
    const limited = await enforceDistributedRateLimit(
      req,
      'stripe-connect-reactivate',
      5,
      60_000,
    )
    if (limited) return limited

    const mem = await getMyMembership()
    if (!mem) {
      return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 })
    }
    if (mem.role !== 'owner') {
      return NextResponse.json(
        { error: 'Solo il titolare può riattivare i pagamenti online.' },
        { status: 403 },
      )
    }
    if (!stripeSecret) {
      return NextResponse.json(
        {
          error: 'Verifica temporaneamente non disponibile. Riprova tra poco.',
          error_code: 'STRIPE_STATUS_UNAVAILABLE',
        },
        { status: 503 },
      )
    }

    const body = await readJsonBody(req, 4_096)
    if (body === null) {
      return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
    }

    const requestedMode = body.payment_mode
    if (
      requestedMode !== undefined &&
      (!paymentModes.has(requestedMode as PaymentModeDefault) ||
        requestedMode === 'in_person')
    ) {
      return NextResponse.json(
        { error: 'Modalità di pagamento non valida.' },
        { status: 400 },
      )
    }

    const db = getSupabaseAdmin()
    const { data: tenant, error: tenantError } = await db
      .from('tenants')
      .select('id, stripe_connect_account_id')
      .eq('id', mem.tenant_id)
      .maybeSingle()

    if (tenantError) throw tenantError
    if (!tenant?.stripe_connect_account_id) {
      return NextResponse.json(
        {
          error: 'Collega prima Stripe Connect per attivare i pagamenti online.',
          error_code: 'STRIPE_NOT_CONNECTED',
        },
        { status: 409 },
      )
    }

    const stripe = new Stripe(stripeSecret)
    const observedAt = new Date().toISOString()
    let account: Stripe.Account
    try {
      account = await stripe.accounts.retrieve(tenant.stripe_connect_account_id)
    } catch {
      return NextResponse.json(
        {
          error: 'Verifica temporaneamente non disponibile. Riprova tra poco.',
          error_code: 'STRIPE_STATUS_UNAVAILABLE',
        },
        { status: 503 },
      )
    }

    const statusPayload = {
      p_stripe_account_id: account.id,
      p_details_submitted: account.details_submitted ?? false,
      p_charges_enabled: account.charges_enabled ?? false,
      p_payouts_enabled: account.payouts_enabled ?? false,
      p_disabled_reason: account.requirements?.disabled_reason ?? null,
      p_requirements: account.requirements ?? null,
      p_observed_at: observedAt,
    }

    const { error: syncError } = await db.rpc(
      'sync_stripe_connect_account_status',
      statusPayload,
    )
    if (syncError) throw syncError

    if (!account.charges_enabled || !account.payouts_enabled) {
      return NextResponse.json(
        {
          error: 'Stripe richiede ancora alcuni passaggi prima di riattivare i pagamenti online.',
          error_code: 'STRIPE_NOT_READY',
          charges_enabled: account.charges_enabled ?? false,
          payouts_enabled: account.payouts_enabled ?? false,
        },
        { status: 409 },
      )
    }

    const { data: confirmed, error: confirmationError } = await db.rpc(
      'confirm_tenant_online_payment_reactivation',
      {
        p_tenant_id: mem.tenant_id,
        p_stripe_account_id: account.id,
        p_payment_mode: (requestedMode as PaymentModeDefault | undefined) ?? null,
      },
    )

    if (confirmationError) throw confirmationError
    if (confirmed !== true) {
      return NextResponse.json(
        {
          error: 'Lo stato Stripe è cambiato. Aggiorna la verifica e riprova.',
          error_code: 'STRIPE_STATE_CHANGED',
        },
        { status: 409 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error('stripe-connect reactivation error:', error)
    return NextResponse.json(
      { error: 'Errore durante la riattivazione dei pagamenti online.' },
      { status: 500 },
    )
  }
}
