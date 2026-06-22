import { redirect } from 'next/navigation'
import { getMyMembership, requirePageAccess } from '@/lib/authz'
import ClosuresClient from './closures-client'

export default async function Page() {
  const mem = await getMyMembership()

  if (!mem) {
    redirect('/login?next=/admin/closures')
  }

  requirePageAccess(mem, 'closures')

  return <ClosuresClient tenantId={mem.tenant_id} />
}