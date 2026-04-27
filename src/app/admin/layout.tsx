import { redirect } from 'next/navigation'
import AdminTopBar from './admin-topbar'
import { getMyMembership, requireAuth } from '@/lib/authz'
import AdminKpis from './admin-kpis'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const mem = await getMyMembership()

  if (!mem) {
    redirect('/login?next=/admin')
  }

  requireAuth(mem, '/admin')

  return (
  <>
    <AdminTopBar tenantId={mem.tenant_id} />
    <AdminKpis tenantId={mem.tenant_id} />
    <div>{children}</div>
  </>
)
}