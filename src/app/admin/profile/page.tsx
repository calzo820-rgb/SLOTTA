import { getMyMembership, requireAuth, requireOwner } from '@/lib/authz'
import ProfileClient from './profile-client'
import { requireManagerSetupOrRedirect } from '@/lib/managerOnboardingServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProfilePage() {
  const mem0 = await getMyMembership()
  const mem = requireAuth(mem0, '/admin/profile')

  requireOwner(mem)
  await requireManagerSetupOrRedirect(mem, '/admin/profile')

  return <ProfileClient tenantId={mem.tenant_id} />
}
