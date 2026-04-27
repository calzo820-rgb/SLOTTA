import { redirect } from 'next/navigation'
import { getMyMembership, requireOwner } from '@/lib/authz'
import ServiceBookingsClient from './service-bookings-client'

export default async function Page() {
  const mem = await getMyMembership()

  if (!mem) {
    redirect('/login?next=/admin/service-bookings')
  }

  requireOwner(mem)

  return <ServiceBookingsClient tenantId={mem.tenant_id} />
}