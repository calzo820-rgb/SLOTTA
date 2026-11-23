import { NextResponse } from 'next/server'
import { getMyMembership } from '@/lib/authz'
import { completeManagerSetup, loadManagerSetupSnapshot } from '@/lib/managerOnboardingServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0' }

function forbiddenResponse(status: 401 | 403, error: string) {
  return NextResponse.json({ error }, { status, headers: privateHeaders })
}

async function getOwnerTenantId() {
  const membership = await getMyMembership()
  if (!membership) return { tenantId: null, response: forbiddenResponse(401, 'Sessione non valida.') }
  if (membership.role !== 'owner') {
    return { tenantId: null, response: forbiddenResponse(403, 'Operazione riservata al titolare.') }
  }
  return { tenantId: membership.tenant_id, response: null }
}

export async function GET() {
  try {
    const { tenantId, response } = await getOwnerTenantId()
    if (response) return response
    const snapshot = await loadManagerSetupSnapshot(tenantId!)
    return NextResponse.json({ ...snapshot, tenantId }, { headers: privateHeaders })
  } catch (error) {
    console.error('manager setup progress load failed', error)
    return NextResponse.json(
      { error: 'Impossibile verificare la configurazione. Riprova.' },
      { status: 500, headers: privateHeaders },
    )
  }
}

export async function POST() {
  try {
    const { tenantId, response } = await getOwnerTenantId()
    if (response) return response
    const result = await completeManagerSetup(tenantId!)
    if (!result.ok) {
      return NextResponse.json(
        {
          error: 'Completa prima orari, operatore e servizio.',
          steps: result.snapshot.steps,
        },
        { status: 422, headers: privateHeaders },
      )
    }
    return NextResponse.json({ ...result.snapshot, tenantId }, { headers: privateHeaders })
  } catch (error) {
    console.error('manager setup completion failed', error)
    return NextResponse.json(
      { error: 'Non è stato possibile salvare il completamento. Riprova.' },
      { status: 500, headers: privateHeaders },
    )
  }
}
