import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function cleanupExpiredPendingBookings(req: Request) {
  try {
    const expectedSecret = process.env.CRON_SECRET
    if (!expectedSecret) {
      console.error('cleanup-pending-bookings: CRON_SECRET non configurato')
      return NextResponse.json(
        { error: 'Configurazione manutenzione non disponibile.' },
        { status: 503 },
      )
    }

    const authHeader = req.headers.get('authorization') || ''
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : ''

if (!bearerToken || bearerToken !== expectedSecret) {
  return NextResponse.json(
    { error: 'Non autorizzato.' },
    { status: 401 },
  )
}

    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    const { data, error } = await supabaseAdmin
      .from('service_bookings')
      .update({
        status: 'cancelled',
        payment_status: 'unpaid',
        checkout_pending: false,
      })
      .eq('status', 'pending')
      .eq('payment_status', 'pending')
      .lt('created_at', cutoff)
      .select('id')

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      cancelled_count: data?.length || 0,
    })
} catch (e: unknown) {
  console.error('cleanup-pending-bookings error:', e)

  const message =
    e instanceof Error
      ? e.message
      : 'Errore cleanup pending bookings'

  return NextResponse.json(
    { error: message },
    { status: 500 },
  )
}
}

export async function GET(req: Request) {
  return cleanupExpiredPendingBookings(req)
}

export async function POST(req: Request) {
  return cleanupExpiredPendingBookings(req)
}
