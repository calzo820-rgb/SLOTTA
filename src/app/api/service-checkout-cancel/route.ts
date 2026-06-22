// src/app/api/service-checkout-cancel/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function isSafeLocalUrl(value: string, origin: string) {
  try {
    const parsed = new URL(value)
    return parsed.origin === origin
  } catch {
    return false
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const origin = url.origin

    const holdId = url.searchParams.get('hold_id')
    const redirectTo = url.searchParams.get('redirect_to') || origin

    if (holdId) {
      await supabaseAdmin
        .from('service_booking_holds')
        .update({ status: 'cancelled' })
        .eq('id', holdId)
        .eq('status', 'pending')
    }

    if (!isSafeLocalUrl(redirectTo, origin)) {
      return NextResponse.redirect(origin)
    }

    return NextResponse.redirect(redirectTo)
  } catch (e) {
    console.error('service-checkout-cancel error:', e)

    const origin = new URL(req.url).origin
    return NextResponse.redirect(origin)
  }
}
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const holdId = String(body?.hold_id || '')

    if (!holdId) {
      return NextResponse.json(
        { error: 'hold_id mancante.' },
        { status: 400 },
      )
    }

    const { error } = await supabaseAdmin
      .from('service_booking_holds')
      .update({ status: 'cancelled' })
      .eq('id', holdId)
      .eq('status', 'pending')

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('service-checkout-cancel POST error:', e)

    return NextResponse.json(
      { error: 'Errore annullamento hold.' },
      { status: 500 },
    )
  }
}