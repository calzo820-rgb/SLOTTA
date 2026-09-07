import { getNowInTimeZone } from '@/lib/bookingRequest'
import {
  eligibleStaffForWindow,
  isWindowWithinTenantAvailability,
  type AvailabilityClosure,
  type AvailabilityHours,
} from '@/lib/bookingSlots'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

type StaffHours = AvailabilityHours & { staff_id: string; dow: number }

type Staff = { id: string; position: number }

export class BookingAvailabilityError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message)
  }
}

export async function loadBookingAvailability(params: {
  tenantId: string
  serviceId: string
  bookingDate: string
  bookingMinutes: number
  requestedStaffId: string | null
}) {
  const {
    tenantId,
    serviceId,
    bookingDate,
    bookingMinutes,
    requestedStaffId,
  } = params
  const db = getSupabaseAdmin()
  const dow = new Date(`${bookingDate}T00:00:00Z`).getUTCDay()

  const [
    tenantResult,
    settingsResult,
    serviceResult,
    staffResult,
    hoursResult,
    staffHoursResult,
    closuresResult,
  ] = await Promise.all([
      db
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .eq('is_active', true)
        .maybeSingle(),
      db
        .from('tenant_settings')
        .select('staff_assign_mode, staff_rr_cursor, lead_minutes, timezone')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      db
        .from('services')
        .select('id, name, duration_minutes, price_cents')
        .eq('tenant_id', tenantId)
        .eq('id', serviceId)
        .eq('is_active', true)
        .maybeSingle(),
      db
        .from('staff_members')
        .select('id, position')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('position', { ascending: true }),
      db
        .from('tenant_hours')
        .select('is_closed, open_time_am, close_time_am, pm_enabled, has_split, open_time_pm, close_time_pm, open_time, close_time')
        .eq('tenant_id', tenantId)
        .eq('dow', dow)
        .maybeSingle(),
      db
        .from('staff_hours')
        .select('staff_id, dow, open_time_am, close_time_am, pm_enabled, open_time_pm, close_time_pm, is_closed')
        .eq('tenant_id', tenantId)
        .eq('dow', dow),
      db
        .from('closures')
        .select('staff_id, closure_type, all_day, start_time, end_time')
        .eq('tenant_id', tenantId)
        .lte('start_date', bookingDate)
        .gte('end_date', bookingDate),
    ])

  const firstError = [
    tenantResult.error,
    settingsResult.error,
    serviceResult.error,
    staffResult.error,
    hoursResult.error,
    staffHoursResult.error,
    closuresResult.error,
  ].find(Boolean)
  if (firstError) throw firstError

  if (!tenantResult.data) {
    throw new BookingAvailabilityError(
      'Attività non trovata o non attiva.',
      404,
      'TENANT_UNAVAILABLE',
    )
  }
  if (!serviceResult.data) {
    throw new BookingAvailabilityError(
      'Servizio non trovato o non attivo.',
      404,
      'SERVICE_UNAVAILABLE',
    )
  }

  const settings = settingsResult.data
  const leadMinutes =
    typeof settings?.lead_minutes === 'number' && settings.lead_minutes >= 0
      ? settings.lead_minutes
      : 30
  const { date: today, minutes: nowMinutes } = getNowInTimeZone(
    settings?.timezone || 'Europe/Rome',
  )
  if (bookingDate < today) {
    throw new BookingAvailabilityError(
      'Non puoi prenotare in una data passata.',
      400,
      'PAST_DATE',
    )
  }
  if (bookingDate === today && bookingMinutes < nowMinutes + leadMinutes) {
    throw new BookingAvailabilityError(
      'Questo orario non è più prenotabile.',
      400,
      'TOO_SOON',
    )
  }

  const duration = Number(serviceResult.data.duration_minutes || 60)
  const bookingEnd = bookingMinutes + duration
  const tenantHours = hoursResult.data as AvailabilityHours | null
  const closures = (closuresResult.data || []) as AvailabilityClosure[]
  if (!tenantHours || tenantHours.is_closed) {
    throw new BookingAvailabilityError(
      'L’attività è chiusa in questa data.',
      409,
      'TENANT_CLOSED',
    )
  }
  if (!isWindowWithinTenantAvailability({
    tenantHours,
    closures,
    start: bookingMinutes,
    end: bookingEnd,
  })) {
    throw new BookingAvailabilityError(
      'L’orario richiesto non è disponibile.',
      409,
      'OUTSIDE_HOURS',
    )
  }

  const staff = (staffResult.data || []) as Staff[]
  if (requestedStaffId && !staff.some(member => member.id === requestedStaffId)) {
    throw new BookingAvailabilityError(
      'Operatore non valido o non attivo.',
      400,
      'STAFF_UNAVAILABLE',
    )
  }
  const eligibleStaff = eligibleStaffForWindow({
    staff,
    staffHours: (staffHoursResult.data || []) as StaffHours[],
    closures,
    dow,
    start: bookingMinutes,
    end: bookingEnd,
    requestedStaffId,
  })
  if (!eligibleStaff.length) {
    throw new BookingAvailabilityError(
      'Nessun operatore disponibile in questo orario.',
      409,
      'STAFF_UNAVAILABLE',
    )
  }

  return {
    service: serviceResult.data,
    staff: eligibleStaff,
    settings: {
      staffAssignMode: (settings?.staff_assign_mode || 'first_free') as
        | 'first_free'
        | 'round_robin',
      roundRobinCursor: Number(settings?.staff_rr_cursor || 0),
    },
    duration,
  }
}
