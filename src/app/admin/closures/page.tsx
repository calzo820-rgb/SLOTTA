import { redirect } from 'next/navigation'
import { getMyMembership, requirePageAccess } from '@/lib/authz'
import ClosuresClient from './closures-client'
import { requireManagerSetupOrRedirect } from '@/lib/managerOnboardingServer'

export default async function Page() {
  const mem = await getMyMembership()

  if (!mem) {
    redirect('/login?next=/admin/closures')
  }

  requirePageAccess(mem, 'closures')
  await requireManagerSetupOrRedirect(mem, '/admin/closures')

  return <ClosuresClient tenantId={mem.tenant_id} />
}
