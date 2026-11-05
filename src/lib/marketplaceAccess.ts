import { getMyMembership, supabaseServer as getAuthenticatedSupabase } from '@/lib/authz'

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true'
}

export function isMarketplacePublicEnabled(): boolean {
  if (!isEnabled(process.env.MARKETPLACE_ENABLED)) return false
  if (
    process.env.VERCEL_ENV === 'production' &&
    !isEnabled(process.env.MARKETPLACE_PUBLIC_LAUNCH_ENABLED)
  ) return false
  return true
}

export function isMarketplaceDemoMode(): boolean {
  if (!isEnabled(process.env.MARKETPLACE_DEMO_MODE)) return false
  return process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development'
}

/**
 * Internal preview access is intentionally independent from the public flag.
 * It requires an explicit environment switch, an email allowlist, a signed-in
 * user whose email is verified, and an active Slotta owner membership.
 */
export async function hasMarketplaceInternalAccess(): Promise<boolean> {
  if (!isEnabled(process.env.MARKETPLACE_INTERNAL_TESTS_ENABLED)) return false

  const allowedEmails = new Set(
    (process.env.MARKETPLACE_INTERNAL_EMAILS || '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
  )
  if (allowedEmails.size === 0) return false

  const supabase = await getAuthenticatedSupabase()
  const { data, error } = await supabase.auth.getUser()
  const user = data.user
  if (error || !user?.email || user.email_confirmed_at == null) return false
  if (!allowedEmails.has(user.email.trim().toLowerCase())) return false

  const membership = await getMyMembership()
  return membership?.role === 'owner'
}
