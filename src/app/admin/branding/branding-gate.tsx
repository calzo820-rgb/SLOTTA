import { redirect } from 'next/navigation'
import { getMyMembership } from '@/lib/authz'
import BrandingClient from './branding-client'

export default async function BrandingGate() {
  const mem = await getMyMembership()

  if (!mem) redirect('/login?next=/admin/branding')
  if (mem.role !== 'owner') redirect('/admin')

  return <BrandingClient />
}


