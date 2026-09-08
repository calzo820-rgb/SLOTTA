import { createHash, randomBytes } from 'node:crypto'

export const BOOKING_MANAGEMENT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
const BOOKING_MANAGEMENT_POST_APPOINTMENT_DAYS = 7

export function createBookingManagementToken() {
  return randomBytes(32).toString('base64url')
}

export function hashBookingManagementToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function isValidBookingManagementToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}

export function bookingManagementExpiry(
  bookingDate: string,
  now = Date.now(),
) {
  const appointmentDate = Date.parse(`${bookingDate}T23:59:59Z`)
  const afterAppointment = Number.isFinite(appointmentDate)
    ? appointmentDate + BOOKING_MANAGEMENT_POST_APPOINTMENT_DAYS * 86_400_000
    : 0

  return new Date(
    Math.max(now + BOOKING_MANAGEMENT_TOKEN_TTL_MS, afterAppointment),
  )
}

export function buildBookingManagementUrl(
  origin: string,
  slug: string,
  token: string,
) {
  const url = new URL(`/t/${encodeURIComponent(slug)}/manage`, origin)
  url.searchParams.set('token', token)
  return url.toString()
}

export function cancellationMinutesRemaining({
  bookingDate,
  bookingTime,
  currentDate,
  currentMinutes,
}: {
  bookingDate: string
  bookingTime: string
  currentDate: string
  currentMinutes: number
}) {
  const bookingDay = Date.parse(`${bookingDate}T00:00:00Z`)
  const currentDay = Date.parse(`${currentDate}T00:00:00Z`)
  const [hours, minutes] = bookingTime.split(':').map(Number)

  if (
    !Number.isFinite(bookingDay) ||
    !Number.isFinite(currentDay) ||
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes)
  ) {
    return Number.NEGATIVE_INFINITY
  }

  return (
    (bookingDay - currentDay) / 60_000 +
    hours * 60 +
    minutes -
    currentMinutes
  )
}

export function canCustomerCancelBooking({
  status,
  paymentStatus,
  minutesRemaining,
  noticeHours,
}: {
  status: string | null
  paymentStatus: string | null
  minutesRemaining: number
  noticeHours: number
}) {
  return (
    (status === 'pending' || status === 'confirmed') &&
    paymentStatus === 'unpaid' &&
    minutesRemaining >= Math.max(0, noticeHours) * 60
  )
}
