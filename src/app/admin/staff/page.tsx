import { getMyMembership, requireAuth, requireOwner } from '@/lib/authz'
import StaffClient from './staff-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function StaffPage() {
  const mem0 = await getMyMembership()
  const mem = requireAuth(mem0, '/admin/staff')

  requireOwner(mem)

  return <StaffClient tenantId={mem.tenant_id} />
}