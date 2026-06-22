import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMyMembership } from '@/lib/authz'

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
    const user_id = String(body.user_id || '').trim()

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id mancante', step }, { status: 400 })
    }

    if (!user_id) {
      return NextResponse.json({ error: 'user_id mancante', step }, { status: 400 })
    }

    if (tenant_id !== mem.tenant_id) {
      return NextResponse.json({ error: 'Tenant non valido', step }, { status: 403 })
    }

    step = 'env'
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: 'Config server mancante', step },
        { status: 500 },
      )
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })

    step = 'check-staff-row'
    const { data: staffRow, error: checkErr } = await admin
      .from('tenant_users')
      .select('id, user_id, username, role, tenant_id')
      .eq('tenant_id', tenant_id)
      .eq('user_id', user_id)
      .eq('role', 'staff')
      .maybeSingle()

    if (checkErr) throw checkErr

    if (!staffRow) {
      return NextResponse.json(
        { error: 'Accesso staff non trovato.', step },
        { status: 404 },
      )
    }

    step = 'delete-tenant-user'
    const { error: deleteRowErr } = await admin
      .from('tenant_users')
      .delete()
      .eq('tenant_id', tenant_id)
      .eq('user_id', user_id)
      .eq('role', 'staff')

    if (deleteRowErr) throw deleteRowErr

    step = 'delete-auth-user'
    const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(user_id)

    if (deleteAuthErr) {
      throw deleteAuthErr
    }

    return NextResponse.json({
      ok: true,
      step: 'done',
      deleted_user_id: user_id,
      username: staffRow.username,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Errore eliminazione accesso staff'

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

    console.error('Errore delete staff access:', {
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