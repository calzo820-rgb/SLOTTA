import { NextResponse } from 'next/server'
import { enforceDistributedRateLimit, readJsonBody } from '@/lib/apiGuard'
import { isUuid } from '@/lib/bookingRequest'
import { verifyHoldCancelToken } from '@/lib/holdCancelToken'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { logApiEvent, observeApiRoute } from '@/lib/apiObservability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isSafeLocalUrl(value: string, origin: string) {
  try {
    return new URL(value).origin === origin
  } catch {
    return false
  }
}

async function cancelPendingHold(holdId: string) {
  const { error } = await getSupabaseAdmin()
    .from('service_booking_holds')
    .update({ status: 'cancelled' })
    .eq('id', holdId)
    .eq('status', 'pending')

  if (error) throw error
}

function hasValidCancellation(holdId: string, token: string) {
  const secret = process.env.STRIPE_SECRET_KEY
  return Boolean(
    secret &&
      isUuid(holdId) &&
      verifyHoldCancelToken(holdId, token, secret),
  )
}

async function handleGet(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin
  const redirectTo = url.searchParams.get('redirect_to') || origin
  const safeRedirect = isSafeLocalUrl(redirectTo, origin) ? redirectTo : origin

  try {
    const limited = await enforceDistributedRateLimit(req, 'service-checkout-cancel', 30, 60_000)
    if (limited) return limited

    const holdId = url.searchParams.get('hold_id') || ''
    const cancelToken = url.searchParams.get('cancel_token') || ''

    if (hasValidCancellation(holdId, cancelToken)) {
      await cancelPendingHold(holdId)
    }

    return NextResponse.redirect(safeRedirect)
  } catch {
    logApiEvent('checkout_hold_cancel_redirect_failed', 'error')
    return NextResponse.redirect(safeRedirect)
  }
}

async function handlePost(req: Request) {
  try {
    const limited = await enforceDistributedRateLimit(req, 'service-checkout-cancel', 30, 60_000)
    if (limited) return limited

    const body = await readJsonBody(req, 4_096)
    if (!body) {
      return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
    }

    const holdId = String(body.hold_id || '')
    const cancelToken = String(body.cancel_token || '')
    if (!hasValidCancellation(holdId, cancelToken)) {
      return NextResponse.json(
        { error: 'Autorizzazione di annullamento non valida o scaduta.' },
        { status: 403 },
      )
    }

    await cancelPendingHold(holdId)
    return NextResponse.json({ ok: true })
  } catch {
    logApiEvent('checkout_hold_cancel_failed', 'error')
    return NextResponse.json(
      { error: 'Errore annullamento hold.' },
      { status: 500 },
    )
  }
}

export const GET = observeApiRoute('/api/service-checkout-cancel', handleGet)
export const POST = observeApiRoute('/api/service-checkout-cancel', handlePost)
