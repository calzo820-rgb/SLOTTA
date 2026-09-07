import { createHash, randomBytes } from 'node:crypto'

export const BOOKING_CONFIRMATION_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function createBookingConfirmationToken() {
  return randomBytes(32).toString('base64url')
}

export function hashBookingConfirmationToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function isValidBookingConfirmationToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}

export function bookingConfirmationExpiry(now = Date.now()) {
  return new Date(now + BOOKING_CONFIRMATION_TOKEN_TTL_MS)
}
