import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Slot coerente con CartPanel e POS/new:
 * - start: ISO string
 * - label: HH:mm
 * - can_select: boolean
 * - blocked: boolean (facoltativo)
 * - remaining / prev_remaining (facoltativi)
 */
type Slot = {
  start: string
  label: string
  can_select: boolean
  blocked?: boolean
  remaining?: number
  prev_remaining?: number
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tenant = searchParams.get('tenant') || searchParams.get('slug') || ''
    const day = searchParams.get('day') || new Date().toISOString().slice(0, 10)

    // ---- CONFIGURAZIONE DEL LOCALE (valori di default) ----
    const cfg = {
      slot_minutes: 10,
      capacity_per_slot: 5,
      lead_time_minutes: 20,
      timezone: 'Europe/Rome',
    }

    // ---- ORARIO DI APERTURA ----
    const open = '18:00'
    const close = '23:00'

    const [openH, openM] = open.split(':').map(Number)
    const [closeH, closeM] = close.split(':').map(Number)

    const startOfDay = new Date(`${day}T00:00:00+01:00`)
    const start = new Date(startOfDay)
    start.setHours(openH, openM, 0, 0)
    const end = new Date(startOfDay)
    end.setHours(closeH, closeM, 0, 0)

    const now = Date.now()
    const slots: Slot[] = []

    for (let t = start.getTime(); t < end.getTime(); t += cfg.slot_minutes * 60_000) {
      const dt = new Date(t)
      const label = dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

      // regola lead time
      const can_select = t >= now + cfg.lead_time_minutes * 60_000

      slots.push({
        start: dt.toISOString(),
        label,
        can_select,
        blocked: false,
        remaining: cfg.capacity_per_slot,
        prev_remaining: cfg.capacity_per_slot,
      })
    }

    return NextResponse.json({
      slots,
      slot_minutes: cfg.slot_minutes,
      capacity_per_slot: cfg.capacity_per_slot,
      lead_time_minutes: cfg.lead_time_minutes,
      timezone: cfg.timezone,
    })
  } catch (err: any) {
    console.error('availability error', err)
    return NextResponse.json(
      {
        slots: [],
        error: true,
        message: err?.message ?? 'unexpected',
      },
      { status: 200 }
    )
  }
}
