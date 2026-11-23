import { getMyMembership, requireAuth, requireOwner } from '@/lib/authz'
import SettingsClient from './settings-client'
import { requireManagerSetupOrRedirect } from '@/lib/managerOnboardingServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SettingsPage() {
  const mem0 = await getMyMembership()
  const mem = requireAuth(mem0, '/admin/settings')

  requireOwner(mem)
  await requireManagerSetupOrRedirect(mem, '/admin/settings')

  return <SettingsClient />
}
