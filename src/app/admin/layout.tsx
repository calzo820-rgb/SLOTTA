import { redirect } from 'next/navigation'
import AdminTopBar from './admin-topbar'
import { getMyMembership, requireAuth } from '@/lib/authz'
import { isManagerSetupPending } from '@/lib/managerOnboardingServer'
import SetupReturnBanner from './setup/SetupReturnBanner'
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
  const setupPending = mem.role === 'owner'
    ? await isManagerSetupPending(mem.tenant_id)
    : false

  return (
    <>
      <AdminTopBar
        tenantId={mem.tenant_id}
        role={mem.role}
        allowedPages={mem.allowed_pages}
      />
      <SetupReturnBanner visible={setupPending} />
      <div>{children}</div>
    </>
  )
}
