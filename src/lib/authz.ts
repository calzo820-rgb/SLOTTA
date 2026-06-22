// src/lib/authz.ts
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'

type Role = 'owner' | 'staff'

export type MyMembership = {
  tenant_id: string
  role: Role
  allowed_pages: string[] | null
  username: string | null
}

export async function supabaseServer() {
  const cookieStore = await cookies() // ✅ QUI

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {}
        },
      },
    },
  )
}

export async function getMyMembership(): Promise<MyMembership | null> {
  const sb = await supabaseServer() // ✅ QUI

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user
  if (!user) return null

 const { data, error } = await sb
  .from('tenant_users')
  .select('tenant_id, role, allowed_pages, username, is_active')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
  if (error || !data) return null
  if (data.is_active === false) return null

  return {
    tenant_id: data.tenant_id,
    role: data.role as Role,
    allowed_pages: (data.allowed_pages ?? null) as string[] | null,
    username: (data.username ?? null) as string | null,
  }
}

export function requireAuth(mem: MyMembership | null, nextPath: string): MyMembership {
  if (!mem) redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  return mem
}

export function requireOwner(mem: MyMembership): void {
  if (mem.role !== 'owner') redirect('/admin')
}
const PAGE_TO_ADMIN_PATH: Record<string, string> = {
  services: '/admin/services',
  bookings: '/admin/service-bookings',
  calendar: '/admin/service-calendar',
  hours: '/admin/hours',
  closures: '/admin/closures',
}

export function canAccessPage(mem: MyMembership, pageKey: string): boolean {
  if (mem.role === 'owner') return true
  return Array.isArray(mem.allowed_pages) && mem.allowed_pages.includes(pageKey)
}

export function firstAllowedAdminPath(mem: MyMembership): string {
  if (mem.role === 'owner') return '/admin/services'

  const allowed = mem.allowed_pages || []

  for (const key of allowed) {
    const path = PAGE_TO_ADMIN_PATH[key]
    if (path) return path
  }

  return '/login'
}

export function requirePageAccess(mem: MyMembership, pageKey: string): void {
  if (!canAccessPage(mem, pageKey)) {
    redirect(firstAllowedAdminPath(mem))
  }
}