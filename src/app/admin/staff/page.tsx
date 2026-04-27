import { getMyMembership } from '@/lib/authz'
import { redirect } from 'next/navigation'
import StaffClient from './staff-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function StaffPage() {
  const mem = await getMyMembership()

  if (!mem) redirect('/login?next=/admin/staff')
  if (mem.role !== 'owner') redirect('/admin')

  return <StaffClient tenantId={mem.tenant_id} />
}
