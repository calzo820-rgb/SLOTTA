import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getPaidCheckoutDetails,
  isStripeFinalizationError,
} from '../src/lib/stripeCheckoutValidation.ts'

const validSession = {
  id: 'cs_test_123',
  mode: 'payment',
  payment_status: 'paid',
  amount_total: 3500,
  currency: 'eur',
  payment_intent: 'pi_123',
  metadata: {
    hold_id: 'hold-1',
    tenant_id: 'tenant-1',
    stripe_connect_account_id: 'acct_123',
  },
}

test('accepts complete paid checkout facts for the connected account', () => {
  assert.deepEqual(getPaidCheckoutDetails(validSession, 'acct_123'), {
    holdId: 'hold-1',
    tenantId: 'tenant-1',
    stripeAccountId: 'acct_123',
    sessionId: 'cs_test_123',
    paymentIntentId: 'pi_123',
    amountTotal: 3500,
    currency: 'eur',
  })
})

test('rejects unpaid, zero-value and non-payment checkout sessions', () => {
  assert.equal(
    getPaidCheckoutDetails({ ...validSession, payment_status: 'unpaid' }, 'acct_123'),
    null,
  )
  assert.equal(
    getPaidCheckoutDetails({ ...validSession, amount_total: 0 }, 'acct_123'),
    null,
  )
  assert.equal(
    getPaidCheckoutDetails({ ...validSession, mode: 'setup' }, 'acct_123'),
    null,
  )
})

test('rejects mismatched or missing Connect account information', () => {
  assert.equal(getPaidCheckoutDetails(validSession, 'acct_other'), null)
  assert.equal(getPaidCheckoutDetails(validSession, null), null)
  assert.equal(
    getPaidCheckoutDetails({ ...validSession, metadata: null }, 'acct_123'),
    null,
  )
})

test('recognizes database finalization errors without exposing arbitrary errors', () => {
  assert.equal(
    isStripeFinalizationError({ message: 'SLOTTA_STRIPE_PAYMENT_MISMATCH' }),
    true,
  )
  assert.equal(isStripeFinalizationError(new Error('connection refused')), false)
})
