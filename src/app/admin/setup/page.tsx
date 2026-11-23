import { getMyMembership, requireAuth, requireOwner } from '@/lib/authz'
import SetupWizard from './SetupWizard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ManagerSetupPage() {
  const membership = requireAuth(await getMyMembership(), '/admin/setup')
  requireOwner(membership)
  return <SetupWizard />
}
