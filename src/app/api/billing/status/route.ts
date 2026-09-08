import { NextResponse } from 'next/server'
import { getMyMembership } from '@/lib/authz'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const membership = await getMyMembership()
  if (!membership) return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 })
  if (membership.role !== 'owner') return NextResponse.json({ error: 'Accesso riservato al proprietario.' }, { status: 403 })

  const { data, error } = await getSupabaseAdmin()
    .from('tenants')
    .select('billing_customer_id, billing_subscription_id, billing_status, billing_current_period_end, trial_ends_at, billing_grace_ends_at')
    .eq('id', membership.tenant_id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Impossibile leggere lo stato del piano.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Attività non trovata.' }, { status: 404 })
  return NextResponse.json(data)
}
