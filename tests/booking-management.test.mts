import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  BOOKING_MANAGEMENT_TOKEN_TTL_MS,
  bookingManagementExpiry,
  buildBookingManagementUrl,
  canCustomerCancelBooking,
  cancellationMinutesRemaining,
  createBookingManagementToken,
  hashBookingManagementToken,
  isValidBookingManagementToken,
} from '../src/lib/bookingManagement.ts'

const cancelRoute = readFileSync(
  new URL(
    '../src/app/api/public/manage-booking/cancel/route.ts',
    import.meta.url,
  ),
  'utf8',
)
const serviceBookRoute = readFileSync(
  new URL('../src/app/api/service-book/route.ts', import.meta.url),
  'utf8',
)
const stripeWebhookRoute = readFileSync(
  new URL('../src/app/api/webhooks/stripe/route.ts', import.meta.url),
  'utf8',
)

test('creates opaque management tokens and stores only stable hashes', () => {
  const first = createBookingManagementToken()
  const second = createBookingManagementToken()

  assert.equal(isValidBookingManagementToken(first), true)
  assert.notEqual(first, second)
  assert.match(hashBookingManagementToken(first), /^[0-9a-f]{64}$/)
  assert.equal(isValidBookingManagementToken('not-a-token'), false)
})

test('keeps management links valid through future appointments', () => {
  const now = Date.parse('2026-09-08T08:00:00Z')
  const normal = bookingManagementExpiry('2026-09-09', now)
  const future = bookingManagementExpiry('2027-03-01', now)

  assert.equal(normal.getTime(), now + BOOKING_MANAGEMENT_TOKEN_TTL_MS)
  assert.ok(future.getTime() > Date.parse('2027-03-01T23:59:59Z'))
})

test('builds an encoded tenant management URL without internal booking IDs', () => {
  const token = createBookingManagementToken()
  const url = new URL(
    buildBookingManagementUrl('https://www.slotta.it', 'studio demo', token),
  )

  assert.equal(url.pathname, '/t/studio%20demo/manage')
  assert.equal(url.searchParams.get('token'), token)
  assert.equal(url.searchParams.has('booking_id'), false)
})

test('calculates notice using the business local calendar', () => {
  assert.equal(
    cancellationMinutesRemaining({
      bookingDate: '2026-09-09',
      bookingTime: '10:30:00',
      currentDate: '2026-09-08',
      currentMinutes: 9 * 60,
    }),
    25 * 60 + 30,
  )
})

test('only unpaid future bookings inside the policy can self-cancel', () => {
  assert.equal(
    canCustomerCancelBooking({
      status: 'confirmed',
      paymentStatus: 'unpaid',
      minutesRemaining: 24 * 60,
      noticeHours: 24,
    }),
    true,
  )
  assert.equal(
    canCustomerCancelBooking({
      status: 'confirmed',
      paymentStatus: 'paid',
      minutesRemaining: 48 * 60,
      noticeHours: 24,
    }),
    false,
  )
  assert.equal(
    canCustomerCancelBooking({
      status: 'confirmed',
      paymentStatus: 'unpaid',
      minutesRemaining: 23 * 60 + 59,
      noticeHours: 24,
    }),
    false,
  )
  assert.equal(
    canCustomerCancelBooking({
      status: 'cancelled',
      paymentStatus: 'unpaid',
      minutesRemaining: 48 * 60,
      noticeHours: 24,
    }),
    false,
  )
})

test('cancellation endpoint is rate limited and applies guarded updates', () => {
  assert.match(cancelRoute, /enforceDistributedRateLimit\(/)
  assert.match(cancelRoute, /readJsonBody\(req, 4_096\)/)
  assert.match(cancelRoute, /loadManagedBooking\(slug, token\)/)
  assert.match(cancelRoute, /\.eq\('payment_status', 'unpaid'\)/)
  assert.match(cancelRoute, /\.in\('status', \['pending', 'confirmed'\]\)/)
  assert.doesNotMatch(cancelRoute, /refunds\.create/)
})

test('booking and Stripe emails include customer management links', () => {
  assert.match(serviceBookRoute, /Gestisci o annulla prenotazione/)
  assert.match(stripeWebhookRoute, /Gestisci prenotazione/)
  assert.match(stripeWebhookRoute, /management_token_hash/)
})
