import { redirect } from 'next/navigation'
import { getMyMembership } from '@/lib/authz'

export default async function AdminGate({
  page,
  children,
}: {
  page: string // es: 'branding', 'services', 'service-calendar'
  children: React.ReactNode
}) {
  const mem = await getMyMembership()
  if (!mem) redirect(`/login?next=/admin/${page}`)

  if (mem.role === 'owner') return <>{children}</>

  // staff
  const allowed = mem.allowed_pages || []
  if (!allowed.includes(page)) redirect('/admin')

  return <>{children}</>
}
