import { NextResponse } from 'next/server'
import { getMyMembership, supabaseServer } from '@/lib/authz'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { matchesTenantName } from '@/lib/accountDeletion'
import { readJsonBody } from '@/lib/apiGuard'
import { observeApiRoute } from '@/lib/apiObservability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function ownerContext() {
  const membership = await getMyMembership()
  if (!membership) return { error: 'Non autorizzato.', status: 401 } as const
  if (membership.role !== 'owner') {
    return { error: 'Operazione riservata al proprietario.', status: 403 } as const
  }

  const server = await supabaseServer()
  const { data } = await server.auth.getUser()
  if (!data.user) return { error: 'Sessione non valida.', status: 401 } as const

  return { membership, userId: data.user.id } as const
}

async function handleGet() {
  const context = await ownerContext()
  if ('error' in context) {
    return NextResponse.json({ error: context.error }, { status: context.status })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('tenant_deletion_requests')
    .select('id, status, requested_at, scheduled_for, cancelled_at')
    .eq('tenant_id', context.membership.tenant_id)
    .eq('status', 'scheduled')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return NextResponse.json({ request: data ?? null }, { headers: { 'Cache-Control': 'no-store' } })
}

async function handlePost(request: Request) {
  const context = await ownerContext()
  if ('error' in context) {
    return NextResponse.json({ error: context.error }, { status: context.status })
  }

  const body = await readJsonBody(request, 4_096)
  if (!body) {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }
  const confirmation = body.confirmation
  const exportAcknowledged = body.export_acknowledged === true

  const admin = getSupabaseAdmin()
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id, name')
    .eq('id', context.membership.tenant_id)
    .maybeSingle()

  if (tenantError) throw tenantError
  if (!tenant) return NextResponse.json({ error: 'Attività non trovata.' }, { status: 404 })
  if (!exportAcknowledged) {
    return NextResponse.json({ error: 'Conferma di aver valutato l’esportazione dei dati.' }, { status: 400 })
  }
  if (!matchesTenantName(confirmation, tenant.name)) {
    return NextResponse.json({ error: 'Il nome dell’attività non corrisponde.' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('tenant_deletion_requests')
    .insert({ tenant_id: tenant.id, requested_by: context.userId })
    .select('id, status, requested_at, scheduled_for, cancelled_at')
    .single()

  if (error?.code === '23505') {
    return NextResponse.json({ error: 'Esiste già una richiesta di cancellazione attiva.' }, { status: 409 })
  }
  if (error) throw error
  return NextResponse.json({ request: data }, { status: 201 })
}

async function handleDelete() {
  const context = await ownerContext()
  if ('error' in context) {
    return NextResponse.json({ error: context.error }, { status: context.status })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('tenant_deletion_requests')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('tenant_id', context.membership.tenant_id)
    .eq('status', 'scheduled')
    .gt('scheduled_for', new Date().toISOString())
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) return NextResponse.json({ error: 'Nessuna richiesta annullabile.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export const GET = observeApiRoute('/api/admin/account-deletion', handleGet)
export const POST = observeApiRoute('/api/admin/account-deletion', handlePost)
export const DELETE = observeApiRoute('/api/admin/account-deletion', handleDelete)
