import assert from 'node:assert/strict'
import test from 'node:test'

import {
  requiresManagerAction,
  shouldAutoAcknowledgePaidBooking,
} from '../src/lib/bookingNotifications.ts'

test('only a completed pending booking requires manager action', () => {
  assert.equal(
    requiresManagerAction({
      status: 'pending',
      payment_status: 'unpaid',
      checkout_pending: false,
    }),
    true,
  )
  assert.equal(
    requiresManagerAction({
      status: 'confirmed',
      payment_status: 'paid',
      checkout_pending: false,
    }),
    false,
  )
  assert.equal(
    requiresManagerAction({
      status: 'pending',
      payment_status: 'unpaid',
      checkout_pending: true,
    }),
    false,
  )
})

test('a new paid confirmed booking is informational and auto acknowledged', () => {
  assert.equal(
    shouldAutoAcknowledgePaidBooking({
      status: 'confirmed',
      payment_status: 'paid',
      manager_seen_at: null,
      checkout_pending: false,
    }),
    true,
  )
  assert.equal(
    shouldAutoAcknowledgePaidBooking({
      status: 'confirmed',
      payment_status: 'paid',
      manager_seen_at: '2026-09-08T12:00:00.000Z',
      checkout_pending: false,
    }),
    false,
  )
  assert.equal(
    shouldAutoAcknowledgePaidBooking({
      status: 'pending',
      payment_status: 'unpaid',
      manager_seen_at: null,
      checkout_pending: false,
    }),
    false,
  )
})
