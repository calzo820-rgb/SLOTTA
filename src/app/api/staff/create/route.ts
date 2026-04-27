import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function normalizeUsername(u: string) {
  return u.trim().toLowerCase()
}

function usernameToEmail(u: string) {
  const user = normalizeUsername(u)
  return `${user}@prenotaora.local`
}

function isValidUsername(u: string) {
  // lettere, numeri, underscore, punto, trattino (no spazi)
  return /^[a-z0-9._-]{3,30}$/.test(u)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const tenant_id = String(body.tenant_id || '').trim()
    const username = normalizeUsername(String(body.username || ''))
    const password = String(body.password || '')
    const allowed_pages = Array.isArray(body.allowed_pages) ? body.allowed_pages.map(String) : []

    if (!tenant_id) return NextResponse.json({ error: 'tenant_id mancante' }, { status: 400 })
    if (!username) return NextResponse.json({ error: 'username mancante' }, { status: 400 })
    if (!isValidUsername(username))
      return NextResponse.json(
        { error: 'username non valido (usa 3-30 caratteri: a-z 0-9 . _ -)' },
        { status: 400 },
      )
    if (password.length < 6) return NextResponse.json({ error: 'password min 6 caratteri' }, { status: 400 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: 'Config server mancante (SUPABASE keys)' }, { status: 500 })
    }

    // 0) Verifica caller via Bearer token (anon client)
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    const supabase = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Token non valido' }, { status: 401 })

    const callerId = userData.user.id

    // 1) Controlla che il caller sia OWNER di quel tenant
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

    // 2) Crea auth user + riga tenant_users con SERVICE ROLE
    const supabaseAdmin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const email = usernameToEmail(username)

    // (opzionale ma utile) evita doppioni: se esiste già quell’email, blocca
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (existing?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase())) {
      return NextResponse.json({ error: 'Username già esistente' }, { status: 409 })
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // ✅ confermato subito
    })
    if (createErr) throw createErr

    const user_id = created.user?.id
    if (!user_id) throw new Error('Auth user non creato')

    const { error: insErr } = await supabaseAdmin
    .from('tenant_users')
    .insert({
      tenant_id,
      user_id,
      username,
      role: 'staff',
      allowed_pages,
      is_active: true,
    })

    if (insErr) {
      // rollback: se fallisce l’insert, elimino l’utente auth appena creato
      await supabaseAdmin.auth.admin.deleteUser(user_id)
      throw insErr
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Errore server' }, { status: 500 })
  }
}
