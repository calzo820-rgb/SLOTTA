
import { getMyMembership, requireAuth, requireOwner } from '@/lib/authz'
import BrandingClient from './branding-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BrandingPage() {
  const mem0 = await getMyMembership()
  const mem = requireAuth(mem0, '/admin/branding')
  requireOwner(mem)

  return <BrandingClient />
}


