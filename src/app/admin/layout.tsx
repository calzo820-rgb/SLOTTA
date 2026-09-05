import { redirect } from 'next/navigation'
import AdminTopBar from './admin-topbar'
import { getMyMembership, requireAuth } from '@/lib/authz'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

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
      <AdminTopBar
        tenantId={mem.tenant_id}
        role={mem.role}
        allowedPages={mem.allowed_pages}
      />
      <div>{children}</div>
    </>
  )
}
