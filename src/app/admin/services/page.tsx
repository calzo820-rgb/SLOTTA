import { redirect } from 'next/navigation'
import { getMyMembership, requireOwner } from '@/lib/authz'
import ServicesClient from './ServicesClient'

export default async function Page() {
  const mem = await getMyMembership()

  if (!mem) {
    redirect('/login?next=/admin/services')
  }

  requireOwner(mem)

  return <ServicesClient tenantId={mem.tenant_id} />
}