import { redirect } from 'next/navigation'
import { getMyMembership, requireOwner } from '@/lib/authz'
import ServiceCalendarClient from './ServiceCalendarClient'

export default async function Page() {
  const mem = await getMyMembership()

  if (!mem) {
    redirect('/login?next=/admin/service-calendar')
  }

  requireOwner(mem)

  return <ServiceCalendarClient tenantId={mem.tenant_id} />
}