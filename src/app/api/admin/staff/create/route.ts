import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { usernameToEmail, normalizeUsername } from '@/lib/usernames'

type Body = {
  tenant_id: string
  username: string
  password: string
  allowed_pages: string[] // es: ['services','calendar']
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body
    const tenantId = body.tenant_id
    const username = normalizeUsername(body.username || '')
    const password = body.password || ''
    const allowed = Array.isArray(body.allowed_pages) ? body.allowed_pages : []

    if (!tenantId) return NextResponse.json({ error: 'tenant_id mancante' }, { status: 400 })
    if (!username || username.length < 3) return NextResponse.json({ error: 'username troppo corto' }, { status: 400 })
    if (!password || password.length < 6) return NextResponse.json({ error: 'password minimo 6 caratteri' }, { status: 400 })

    const email = usernameToEmail(username)

    // 1) crea auth user
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 })
    const userId = created.user?.id
    if (!userId) return NextResponse.json({ error: 'User creato ma id mancante' }, { status: 500 })

    // 2) crea membership staff (1 salone per utente)
  const { error: mErr } = await supabaseAdmin
  .from('tenant_users')
  .insert({
    user_id: userId,
    tenant_id: tenantId,
    role: 'staff',
    username,
    is_active: true,
    allowed_pages: allowed,
  })
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 })

    // 3) salva permessi pagine
    const { error: pErr } = await supabaseAdmin
      .from('tenant_users')
      .upsert({ user_id: userId, allowed_pages: allowed }, { onConflict: 'user_id' })
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, user_id: userId, username })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Errore server' }, { status: 500 })
  }
}
