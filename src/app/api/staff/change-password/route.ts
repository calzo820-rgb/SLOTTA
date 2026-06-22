import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const tenant_id = String(body.tenant_id || '').trim()
    const user_id = String(body.user_id || '').trim()
    const password = String(body.password || '')

    if (!tenant_id) return NextResponse.json({ error: 'tenant_id mancante' }, { status: 400 })
    if (!user_id) return NextResponse.json({ error: 'user_id mancante' }, { status: 400 })
    if (!password || password.length < 6)
      return NextResponse.json({ error: 'Password troppo corta (min 6)' }, { status: 400 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: 'Config server mancante (SUPABASE keys)' }, { status: 500 })
    }

    // 1) Verifica caller via Bearer token (anon client)
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    const supabase = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Token non valido' }, { status: 401 })

    const callerId = userData.user.id

    // 2) Controlla che il caller sia OWNER di quel tenant
    const { data: callerRow, error: callerRowErr } = await supabase
      .from('tenant_users')
      .select('id, tenant_id, role, is_active')
      .eq('user_id', callerId)
      .eq('tenant_id', tenant_id)
      .maybeSingle()

    if (callerRowErr) throw callerRowErr
    if (!callerRow || callerRow.role !== 'owner' || callerRow.is_active === false) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }

    // 3) Controlla che l’utente target appartenga allo stesso tenant
    const { data: targetRow, error: targetErr } = await supabase
      .from('tenant_users')
      .select('id, tenant_id, role')
      .eq('user_id', user_id)
      .eq('tenant_id', tenant_id)
      .maybeSingle()

    if (targetErr) throw targetErr
    if (!targetRow) {
      return NextResponse.json({ error: 'Utente non trovato per questo salone' }, { status: 404 })
    }

    // 4) Aggiorna password con service role (solo server)
    const supabaseAdmin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password })
    if (updErr) throw updErr

    return NextResponse.json({ ok: true })
} catch (e: unknown) {
  console.error('staff change password error:', e)

  const message =
    e instanceof Error ? e.message : 'Errore cambio password.'

  return NextResponse.json(
    { error: message },
    { status: 500 },
  )
}
}
