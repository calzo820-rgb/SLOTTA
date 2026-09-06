import { NextResponse } from 'next/server'
import { enforceDistributedRateLimit, readJsonBody } from '@/lib/apiGuard'
import { isUuid, isValidBookingDate } from '@/lib/bookingRequest'
import { supabaseServer } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const limited = await enforceDistributedRateLimit(req, 'booking-config', 120, 60_000)
    if (limited) return limited

    const body = await readJsonBody(req, 4_096)
    if (!body) {
      return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
    }

    const tenantId = String(body.tenant_id || '')
    const bookingDate = String(body.booking_date || '')

    if (!isUuid(tenantId) || !isValidBookingDate(bookingDate)) {
      return NextResponse.json({ error: 'Parametri non validi.' }, { status: 400 })
    }

    const db = supabaseServer()
    const dow = new Date(`${bookingDate}T00:00:00Z`).getUTCDay()

    const { data: tenant, error: tenantError } = await db
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .eq('is_active', true)
      .maybeSingle()

    if (tenantError) throw tenantError
    if (!tenant) {
      return NextResponse.json({ error: 'Attività non trovata.' }, { status: 404 })
    }

    const [settingsResult, staffResult, hoursResult, staffHoursResult, closuresResult] =
      await Promise.all([
        db
          .from('tenant_settings')
          .select(
            'slot_minutes, service_staff_count, payment_mode_default, staff_selection_mode, lead_minutes',
          )
          .eq('tenant_id', tenantId)
          .maybeSingle(),
        db
          .from('staff_members')
          .select('id, name, is_active, position')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('position', { ascending: true })
          .order('name', { ascending: true }),
        db
          .from('tenant_hours')
          .select(
            'dow, is_closed, open_time_am, close_time_am, pm_enabled, has_split, open_time_pm, close_time_pm, open_time, close_time',
          )
          .eq('tenant_id', tenantId)
          .eq('dow', dow)
          .maybeSingle(),
        db
          .from('staff_hours')
          .select(
            'staff_id, dow, open_time_am, close_time_am, pm_enabled, open_time_pm, close_time_pm, is_closed',
          )
          .eq('tenant_id', tenantId),
        db
          .from('closures')
          .select(
            'id, staff_id, closure_type, start_date, end_date, all_day, start_time, end_time',
          )
          .eq('tenant_id', tenantId)
          .lte('start_date', bookingDate)
          .gte('end_date', bookingDate),
      ])

    const firstError = [
      settingsResult.error,
      staffResult.error,
      hoursResult.error,
      staffHoursResult.error,
      closuresResult.error,
    ].find(Boolean)

    if (firstError) throw firstError

    return NextResponse.json({
      settings: settingsResult.data,
      staff: staffResult.data || [],
      tenant_hours: hoursResult.data,
      staff_hours: staffHoursResult.data || [],
      closures: closuresResult.data || [],
    })
  } catch (error) {
    console.error('booking-config error:', error)
    return NextResponse.json(
      { error: 'Errore caricamento configurazione.' },
      { status: 500 },
    )
  }
}
