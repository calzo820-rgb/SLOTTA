import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMyMembership, supabaseServer } from '@/lib/authz'

export async function POST(req: Request) {
  const mem = await getMyMembership()
  if (!mem || mem.role !== 'owner') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { user_id } = await req.json()
  const targetUserId = String(user_id || '')
  if (!targetUserId) {
    return NextResponse.json({ error: 'user_id mancante' }, { status: 400 })
  }

  const sb = supabaseServer


  // evita auto-delete owner
  const { data: authData } = await sb.auth.getUser()
  const me = authData?.user
  if (me?.id === targetUserId) {
    return NextResponse.json({ error: 'Non puoi rimuovere te stesso.' }, { status: 400 })
  }

  // verifica stesso tenant
  const { data: tu, error: tuErr } = await sb
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', targetUserId) // ✅ user_id
    .maybeSingle()

  if (tuErr) return NextResponse.json({ error: tuErr.message }, { status: 400 })
  if (!tu || tu.tenant_id !== mem.tenant_id) {
    return NextResponse.json({ error: 'Utente non nel tuo salone' }, { status: 400 })
  }

  // 1) cancella membership
  const { error: delMapErr } = await sb.from('tenant_users').delete().eq('user_id', targetUserId)
  if (delMapErr) return NextResponse.json({ error: delMapErr.message }, { status: 400 })

  // 2) cancella user auth (service role)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { error: delUserErr } = await admin.auth.admin.deleteUser(targetUserId)
  if (delUserErr) return NextResponse.json({ error: delUserErr.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
