import 'server-only'

import { getNowInTimeZone } from '@/lib/bookingRequest'
import {
  canCustomerCancelBooking,
  cancellationMinutesRemaining,
  hashBookingManagementToken,
  isValidBookingManagementToken,
} from '@/lib/bookingManagement'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export type ManagedBooking = {
  id: string
  tenant_id: string
  service_id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  booking_date: string
  booking_time: string
  status: 'pending' | 'confirmed' | 'done' | 'cancelled'
  payment_status: string
  price_cents: number | null
  customer_cancelled_at: string | null
}

export type BookingCancellationState =
  | 'available'
  | 'cancelled'
  | 'paid'
  | 'completed'
  | 'too_late'

export async function loadManagedBooking(slug: string, token: string) {
  if (!slug || !isValidBookingManagementToken(token)) return null

  const db = getSupabaseAdmin()
  const now = new Date()
  const tokenHash = hashBookingManagementToken(token)

  const { data: tenant, error: tenantError } = await db
    .from('tenants')
    .select('id, name, slug, contact_email, phone, whatsapp_phone')
    .eq('slug', slug)
    .maybeSingle()

  if (tenantError) throw tenantError
  if (!tenant) return null

  const [{ data: booking, error: bookingError }, { data: settings, error: settingsError }] =
    await Promise.all([
      db
        .from('service_bookings')
        .select(
          'id, tenant_id, service_id, customer_name, customer_email, customer_phone, booking_date, booking_time, status, payment_status, price_cents, customer_cancelled_at',
        )
        .eq('tenant_id', tenant.id)
        .eq('management_token_hash', tokenHash)
        .gt('management_token_expires_at', now.toISOString())
        .maybeSingle(),
      db
        .from('tenant_settings')
        .select('timezone, customer_cancellation_notice_hours')
        .eq('tenant_id', tenant.id)
        .maybeSingle(),
    ])

  if (bookingError) throw bookingError
  if (settingsError) throw settingsError
  if (!booking) return null

  const { data: service, error: serviceError } = await db
    .from('services')
    .select('name, duration_minutes, price_cents')
    .eq('id', booking.service_id)
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  if (serviceError) throw serviceError

  const timezone = settings?.timezone || 'Europe/Rome'
  const noticeHours = Number(settings?.customer_cancellation_notice_hours ?? 24)
  const current = getNowInTimeZone(timezone, now)
  const minutesRemaining = cancellationMinutesRemaining({
    bookingDate: booking.booking_date,
    bookingTime: booking.booking_time,
    currentDate: current.date,
    currentMinutes: current.minutes,
  })
  const canCancel = canCustomerCancelBooking({
    status: booking.status,
    paymentStatus: booking.payment_status,
    minutesRemaining,
    noticeHours,
  })

  let cancellationState: BookingCancellationState = 'available'
  if (booking.status === 'cancelled') cancellationState = 'cancelled'
  else if (booking.status === 'done' || minutesRemaining < 0) cancellationState = 'completed'
  else if (booking.payment_status !== 'unpaid') cancellationState = 'paid'
  else if (!canCancel) cancellationState = 'too_late'

  return {
    tenant,
    booking: booking as ManagedBooking,
    service,
    timezone,
    noticeHours,
    minutesRemaining,
    canCancel,
    cancellationState,
  }
}
