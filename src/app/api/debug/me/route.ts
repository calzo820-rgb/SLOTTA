import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/authz'

export async function GET() {
const sb = await supabaseServer()

const { data: u } = await sb.auth.getUser()

  const user = u?.user
  if (!user) return NextResponse.json({ user: null })

  const { data: mem, error } = await sb
    .from('tenant_users')
    .select('tenant_id, role, username, allowed_pages, is_active')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    user_id: user.id,
    email: user.email,
    membership: mem ?? null,
    membership_error: error?.message ?? null,
  })
}
