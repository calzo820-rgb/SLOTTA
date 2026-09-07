import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  BOOKING_CONFIRMATION_TOKEN_TTL_MS,
  bookingConfirmationExpiry,
  createBookingConfirmationToken,
  hashBookingConfirmationToken,
  isValidBookingConfirmationToken,
} from '../src/lib/bookingConfirmationToken.ts'

const successPage = readFileSync(
  new URL('../src/app/t/[slug]/success/page.tsx', import.meta.url),
  'utf8',
)

test('creates unpredictable confirmation tokens and stores stable hashes', () => {
  const first = createBookingConfirmationToken()
  const second = createBookingConfirmationToken()

  assert.equal(isValidBookingConfirmationToken(first), true)
  assert.equal(isValidBookingConfirmationToken(second), true)
  assert.notEqual(first, second)
  assert.match(hashBookingConfirmationToken(first), /^[0-9a-f]{64}$/)
  assert.equal(hashBookingConfirmationToken(first), hashBookingConfirmationToken(first))
  assert.notEqual(hashBookingConfirmationToken(first), hashBookingConfirmationToken(second))
})

test('rejects malformed tokens and calculates a limited lifetime', () => {
  assert.equal(isValidBookingConfirmationToken(''), false)
  assert.equal(isValidBookingConfirmationToken('an-internal-booking-id'), false)
  assert.equal(isValidBookingConfirmationToken('a'.repeat(42)), false)
  assert.equal(
    bookingConfirmationExpiry(1_000).getTime(),
    1_000 + BOOKING_CONFIRMATION_TOKEN_TTL_MS,
  )
})

test('success page never looks up confirmations by booking or Stripe IDs', () => {
  assert.match(successPage, /confirmation_token_hash/)
  assert.match(successPage, /confirmation_token_revoked_at/)
  assert.match(successPage, /confirmation_token_expires_at/)
  assert.doesNotMatch(successPage, /\.eq\('id', bookingId\)/)
  assert.doesNotMatch(successPage, /\.eq\('stripe_session_id', sessionId\)/)
})
