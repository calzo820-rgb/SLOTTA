import { getMyMembership, requireAuth, requireOwner } from '@/lib/authz'
import BillingClient from './billing-client'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const membership = requireAuth(await getMyMembership(), '/admin/billing')
  requireOwner(membership)
  return <BillingClient />
}
