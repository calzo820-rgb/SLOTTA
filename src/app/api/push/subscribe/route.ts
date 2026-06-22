import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '').trim()

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Non autenticato.' },
        { status: 401 },
      )
    }

    const body = await req.json()

    const tenantId = body?.tenant_id as string | undefined
    const subscription = body?.subscription

    const endpoint = subscription?.endpoint
    const p256dh = subscription?.keys?.p256dh
    const auth = subscription?.keys?.auth

    if (!tenantId || !endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: 'Dati sottoscrizione mancanti.' },
        { status: 400 },
      )
    }

    const {
      data: { user },
      error: userErr,
    } = await supabaseAdmin.auth.getUser(accessToken)

    if (userErr || !user) {
      return NextResponse.json(
        { error: 'Sessione non valida.' },
        { status: 401 },
      )
    }

    const { data: membership, error: membershipErr } = await supabaseAdmin
      .from('tenant_users')
      .select('tenant_id, user_id, role')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipErr) {
      return NextResponse.json(
        { error: membershipErr.message },
        { status: 500 },
      )
    }

    if (!membership) {
      return NextResponse.json(
        { error: 'Non autorizzato per questo salone.' },
        { status: 403 },
      )
    }

    const userAgent = req.headers.get('user-agent') || null

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          tenant_id: tenantId,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' },
      )

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
  console.error('push subscribe error:', e)

  const message =
    e instanceof Error ? e.message : 'Errore salvataggio notifiche push.'

  return NextResponse.json(
    { error: message },
    { status: 500 },
  )
}
}