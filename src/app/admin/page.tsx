import { redirect } from 'next/navigation'
import { getMyMembership, requireAuth } from '@/lib/authz'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminPage() {
  const mem0 = await getMyMembership()
  const mem = requireAuth(mem0, '/admin')

  if (mem.role === 'owner') {
    redirect('/admin/service-bookings')
  }

  const allowed = mem.allowed_pages || []

  if (allowed.includes('bookings')) redirect('/admin/service-bookings')
  if (allowed.includes('calendar')) redirect('/admin/service-calendar')
  if (allowed.includes('services')) redirect('/admin/services')
  if (allowed.includes('hours')) redirect('/admin/hours')
  if (allowed.includes('closures')) redirect('/admin/closures')

  redirect('/login')
}