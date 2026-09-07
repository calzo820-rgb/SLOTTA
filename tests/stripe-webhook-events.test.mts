import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getCheckoutLifecycleDetails,
  getDisputeDetails,
  getRefundDetails,
  stripeId,
} from '../src/lib/stripeWebhookEvents.ts'

test('validates Checkout lifecycle events against metadata and Connect account', () => {
  const session = {
    id: 'cs_123',
    metadata: {
      hold_id: 'hold-1',
      tenant_id: 'tenant-1',
      stripe_connect_account_id: 'acct_1',
    },
  }

  assert.deepEqual(getCheckoutLifecycleDetails(session, 'acct_1'), {
    holdId: 'hold-1',
    tenantId: 'tenant-1',
    sessionId: 'cs_123',
    stripeAccountId: 'acct_1',
  })
  assert.equal(getCheckoutLifecycleDetails(session, 'acct_other'), null)
  assert.equal(getCheckoutLifecycleDetails(session, null), null)
})

test('extracts Stripe IDs without accepting empty references', () => {
  assert.equal(stripeId('pi_123'), 'pi_123')
  assert.equal(stripeId({ id: 'ch_123' }), 'ch_123')
  assert.equal(stripeId('   '), null)
  assert.equal(stripeId(null), null)
})

test('accepts coherent refund facts and rejects malformed amounts or currency', () => {
  const charge = {
    id: 'ch_123',
    payment_intent: 'pi_123',
    amount_refunded: 1500,
    currency: 'eur',
  }

  assert.deepEqual(getRefundDetails(charge, 'acct_1'), {
    stripeAccountId: 'acct_1',
    chargeId: 'ch_123',
    paymentIntentId: 'pi_123',
    amountRefunded: 1500,
    currency: 'eur',
  })
  assert.equal(getRefundDetails({ ...charge, amount_refunded: -1 }, 'acct_1'), null)
  assert.equal(getRefundDetails({ ...charge, currency: 'EUR' }, 'acct_1'), null)
})

test('requires the PaymentIntent and Connect account for dispute events', () => {
  const dispute = {
    id: 'dp_123',
    charge: 'ch_123',
    payment_intent: { id: 'pi_123' },
    status: 'needs_response',
  }

  assert.deepEqual(getDisputeDetails(dispute, 'acct_1'), {
    stripeAccountId: 'acct_1',
    chargeId: 'ch_123',
    disputeId: 'dp_123',
    paymentIntentId: 'pi_123',
    status: 'needs_response',
  })
  assert.equal(
    getDisputeDetails({ ...dispute, payment_intent: null }, 'acct_1'),
    null,
  )
})
