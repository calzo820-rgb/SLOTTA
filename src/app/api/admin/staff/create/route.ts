import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMyMembership } from '@/lib/authz'

function normalizeUsername(u: string) {
  return u.trim().toLowerCase().replace(/\s+/g, '')
}

function normalizeStaffCode(code: string) {
  return String(code || '').trim().replace(/\D/g, '')
}

function staffUsernameToEmail(username: string, staffCode: string) {
  const user = normalizeUsername(username)
  const code = normalizeStaffCode(staffCode)

  return `${user}.${code}@slotta.local`
}

function isValidUsername(u: string) {
  return /^[a-z0-9._-]{3,30}$/.test(u)
}

export async function POST(req: Request) {
  let step = 'start'

  try {
    step = 'membership'
    const mem = await getMyMembership()

    if (!mem || mem.role !== 'owner') {
      return NextResponse.json({ error: 'Non autorizzato', step }, { status: 403 })
    }

    step = 'read-body'
    const body = await req.json()

    const tenant_id = String(body.tenant_id || '').trim()
    const username = normalizeUsername(String(body.username || ''))
    const password = String(body.password || '')
    const allowed_pages = Array.isArray(body.allowed_pages)
      ? body.allowed_pages.map(String)
      : []

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id mancante', step }, { status: 400 })
    }

    if (tenant_id !== mem.tenant_id) {
      return NextResponse.json({ error: 'Tenant non valido', step }, { status: 403 })
    }

    if (!username) {
      return NextResponse.json({ error: 'username mancante', step }, { status: 400 })
    }

    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: 'username non valido (3-30: a-z 0-9 . _ -)', step },
        { status: 400 },
      )
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'password min 6 caratteri', step }, { status: 400 })
    }

    if (allowed_pages.length === 0) {
      return NextResponse.json(
        { error: 'Seleziona almeno una pagina accessibile.', step },
        { status: 400 },
      )
    }

    step = 'env'
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: 'Config server mancante (SUPABASE url/key)', step },
        { status: 500 },
      )
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })

    step = 'load-tenant-code'
    const { data: tenantRow, error: tenantErr } = await admin
      .from('tenants')
      .select('staff_login_code')
      .eq('id', tenant_id)
      .maybeSingle()

    if (tenantErr) throw tenantErr

    const staffLoginCode = normalizeStaffCode(tenantRow?.staff_login_code || '')

    if (!/^[0-9]{6}$/.test(staffLoginCode)) {
      return NextResponse.json(
        { error: 'Codice attività non configurato o non valido.', step },
        { status: 400 },
      )
    }

    const email = staffUsernameToEmail(username, staffLoginCode)

    step = 'check-existing-tenant-user'
    const { data: existingTenantUser, error: existingTenantUserErr } = await admin
      .from('tenant_users')
      .select('user_id, username')
      .eq('tenant_id', tenant_id)
      .eq('username', username)
      .maybeSingle()

    if (existingTenantUserErr) throw existingTenantUserErr

    if (existingTenantUser) {
      return NextResponse.json(
        { error: 'Username già utilizzato per questa attività. Scegline un altro.', step },
        { status: 409 },
      )
    }

    step = 'create-auth-user'
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createErr) {
      const msg = String(createErr.message || '').toLowerCase()

      if (
        msg.includes('already been registered') ||
        msg.includes('already registered') ||
        msg.includes('user already registered') ||
        msg.includes('email exists')
      ) {
        return NextResponse.json(
          { error: 'Username già utilizzato. Scegline un altro.', step },
          { status: 409 },
        )
      }

      throw createErr
    }

    const newUserId = created.user?.id
    if (!newUserId) throw new Error('Auth user non creato')

    step = 'insert-tenant-user'
    const { error: insErr } = await admin.from('tenant_users').insert({
      tenant_id,
      user_id: newUserId,
      username,
      role: 'staff',
      allowed_pages,
      is_active: true,
    })

    if (insErr) {
      await admin.auth.admin.deleteUser(newUserId)
      throw insErr
    }

    return NextResponse.json({
      ok: true,
      step: 'done',
      username,
      staff_login_code: staffLoginCode,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Errore server'

    const errorDetails =
      typeof e === 'object' && e !== null && 'details' in e
        ? String((e as { details?: unknown }).details || '')
        : ''

    const errorCode =
      typeof e === 'object' && e !== null && 'code' in e
        ? String((e as { code?: unknown }).code || '')
        : ''

    const errorHint =
      typeof e === 'object' && e !== null && 'hint' in e
        ? String((e as { hint?: unknown }).hint || '')
        : ''

    console.error('Errore create staff access:', {
      step,
      message,
      details: errorDetails || null,
      code: errorCode || null,
      hint: errorHint || null,
    })

    return NextResponse.json(
      {
        error: message,
        step,
        details: errorDetails || null,
        code: errorCode || null,
        hint: errorHint || null,
      },
      { status: 500 },
    )
  }
}