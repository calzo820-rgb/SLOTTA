import { getMyMembership, requireAuth, requireOwner } from '@/lib/authz'
import BillingClient from './billing-client'
import { requireManagerSetupOrRedirect } from '@/lib/managerOnboardingServer'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const membership = requireAuth(await getMyMembership(), '/admin/billing')
  requireOwner(membership)
  await requireManagerSetupOrRedirect(membership, '/admin/billing')
  return <BillingClient />
}
