import { getMyMembership, requireAuth, requireOwner } from '@/lib/authz'
import SettingsClient from './settings-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SettingsPage() {
  const mem0 = await getMyMembership()
  const mem = requireAuth(mem0, '/admin/settings')

  requireOwner(mem)

  return <SettingsClient />
}