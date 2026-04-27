import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMyMembership } from '@/lib/authz'

function normalizeUsername(u: string) {
  return u.trim().toLowerCase()
}
function usernameToEmail(u: string) {
  return `${normalizeUsername(u)}@prenotaora.local`
}
function isValidUsername(u: string) {
  return /^[a-z0-9._-]{3,30}$/.test(u)
}

export async function POST(req: Request) {
  try {
    const mem = await getMyMembership()
    if (!mem || mem.role !== 'owner') {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const body = await req.json()
    const tenant_id = String(body.tenant_id || '').trim()
    const username = normalizeUsername(String(body.username || ''))
    const password = String(body.password || '')
    const allowed_pages = Array.isArray(body.allowed_pages) ? body.allowed_pages.map(String) : []

    if (!tenant_id) return NextResponse.json({ error: 'tenant_id mancante' }, { status: 400 })
    if (tenant_id !== mem.tenant_id) return NextResponse.json({ error: 'Tenant non valido' }, { status: 403 })

    if (!username) return NextResponse.json({ error: 'username mancante' }, { status: 400 })
    if (!isValidUsername(username))
      return NextResponse.json({ error: 'username non valido (3-30: a-z 0-9 . _ -)' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'password min 6 caratteri' }, { status: 400 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Config server mancante (SUPABASE url/key)' }, { status: 500 })
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const email = usernameToEmail(username)

    // 1) crea auth user (CONFERMATO SUBITO)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr) throw createErr

    const newUserId = created.user?.id
    if (!newUserId) throw new Error('Auth user non creato')

    // 2) inserisci membership nel DB
    const { error: insErr } = await admin.from('tenant_users').insert({
      tenant_id,
      user_id: newUserId,
      username,
      role: 'staff',
      allowed_pages,
      is_active: true,
    })

    if (insErr) {
      await admin.auth.admin.deleteUser(newUserId) // rollback
      throw insErr
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Errore server' }, { status: 500 })
  }
}
