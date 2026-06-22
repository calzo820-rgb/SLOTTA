import { redirect } from 'next/navigation'
import { getMyMembership, requirePageAccess } from '@/lib/authz'
import HoursClient from './hours-client'

export default async function Page() {
  const mem = await getMyMembership()

  if (!mem) {
    redirect('/login?next=/admin/hours')
  }

  requirePageAccess(mem, 'hours')

  return <HoursClient tenantId={mem.tenant_id} />
}