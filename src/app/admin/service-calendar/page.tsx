import { redirect } from 'next/navigation'
import { getMyMembership, requirePageAccess } from '@/lib/authz'
import ServiceCalendarClient from './ServiceCalendarClient'

export default async function Page() {
  const mem = await getMyMembership()

  if (!mem) {
    redirect('/login?next=/admin/service-calendar')
  }

  requirePageAccess(mem, 'calendar')

  return <ServiceCalendarClient tenantId={mem.tenant_id} />
}