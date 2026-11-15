import { NextResponse } from 'next/server'
import { getMyMembership } from '@/lib/authz'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  try {
    const mem = await getMyMembership()
    if (!mem) {
      return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 })
    }

    const { data: tenant, error: tenantError } = await getSupabaseAdmin()
      .from('tenants')
      .select(
        'stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled',
      )
      .eq('id', mem.tenant_id)
      .maybeSingle()

    if (tenantError) throw tenantError
    if (!tenant) {
      return NextResponse.json({ error: 'Attività non trovata.' }, { status: 404 })
    }

    const { data: settings, error: settingsError } = await getSupabaseAdmin()
      .from('tenant_settings')
      .select('payment_mode_default, online_payments_reactivation_required')
      .eq('tenant_id', mem.tenant_id)
      .maybeSingle()

    if (settingsError) throw settingsError

    const stripeReady =
      Boolean(tenant.stripe_connect_account_id) &&
      tenant.stripe_connect_charges_enabled === true &&
      tenant.stripe_connect_payouts_enabled === true

    return NextResponse.json({
      stripe_ready: stripeReady,
      reactivation_required:
        settings?.online_payments_reactivation_required === true,
      payment_mode_default: settings?.payment_mode_default || 'in_person',
    })
  } catch {
    return NextResponse.json(
      { error: 'Impossibile verificare lo stato dei pagamenti.' },
      { status: 500 },
    )
  }
}
