import assert from 'node:assert/strict'
import test from 'node:test'

import {
  bookingTimeToMinutes,
  getNowInTimeZone,
  hasValidBookingCustomer,
  isValidBookingDate,
  isUuid,
} from '../src/lib/bookingRequest.ts'

test('accepts real calendar dates and rejects impossible ones', () => {
  assert.equal(isValidBookingDate('2028-02-29'), true)
  assert.equal(isValidBookingDate('2027-02-29'), false)
  assert.equal(isValidBookingDate('2026-13-01'), false)
  assert.equal(isValidBookingDate('01/09/2026'), false)
})

test('validates identifiers and bounds customer data', () => {
  assert.equal(isUuid('123e4567-e89b-42d3-a456-426614174000'), true)
  assert.equal(isUuid('not-a-uuid'), false)
  assert.equal(hasValidBookingCustomer({ name: 'Mario Rossi', email: 'mario@example.com', phone: '+39 333 1234567', note: null }), true)
  assert.equal(hasValidBookingCustomer({ name: 'M', email: 'bad', phone: '123', note: 'x'.repeat(1_001) }), false)
})

test('accepts database times and rejects values outside a day', () => {
  assert.equal(bookingTimeToMinutes('09:30'), 570)
  assert.equal(bookingTimeToMinutes('23:59:00'), 1439)
  assert.equal(bookingTimeToMinutes('24:00'), null)
  assert.equal(bookingTimeToMinutes('not-a-time'), null)
})

test('uses the business timezone instead of the server timezone', () => {
  const now = new Date('2026-01-15T23:30:00.000Z')

  assert.deepEqual(getNowInTimeZone('Europe/Rome', now), {
    date: '2026-01-16',
    minutes: 30,
  })
})
