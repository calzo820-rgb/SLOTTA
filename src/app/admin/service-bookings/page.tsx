import { redirect } from 'next/navigation'
import { getMyMembership, requirePageAccess } from '@/lib/authz'
import ServiceBookingsClient from './service-bookings-client'
import { requireManagerSetupOrRedirect } from '@/lib/managerOnboardingServer'

export default async function Page() {
  const mem = await getMyMembership()

  if (!mem) {
    redirect('/login?next=/admin/service-bookings')
  }

  requirePageAccess(mem, 'bookings')
  await requireManagerSetupOrRedirect(mem, '/admin/service-bookings')

  return <ServiceBookingsClient tenantId={mem.tenant_id} />
}
