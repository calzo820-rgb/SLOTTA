import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createWithIdempotencyRetry,
  getEffectivePaymentMode,
  isStripeConnectReady,
  shouldRequireOnlinePaymentReactivation,
} from '../src/lib/stripeConnectPayments.ts'

test('checkout ritenta con la stessa chiave idempotente se la prima risposta fallisce', async () => {
  let attempts = 0
  const calls: string[] = []

  const result = await createWithIdempotencyRetry(async () => {
    attempts += 1
    calls.push('slotta-checkout-hold-test')
    if (attempts === 1) throw new Error('risposta Stripe persa')
    return 'cs_test_recovered'
  })

  assert.equal(result, 'cs_test_recovered')
  assert.equal(attempts, 2)
  assert.deepEqual(calls, ['slotta-checkout-hold-test', 'slotta-checkout-hold-test'])
})

test('Stripe è pronto solo con account collegato, addebiti e bonifici abilitati', () => {
  assert.equal(
    isStripeConnectReady({ connected: true, chargesEnabled: true, payoutsEnabled: true }),
    true,
  )
  assert.equal(
    isStripeConnectReady({ connected: true, chargesEnabled: true, payoutsEnabled: false }),
    false,
  )
  assert.equal(
    isStripeConnectReady({ connected: false, chargesEnabled: true, payoutsEnabled: true }),
    false,
  )
})

test('la sospensione persistente nasce solo da una perdita effettiva dopo uno stato pronto', () => {
  assert.equal(shouldRequireOnlinePaymentReactivation(false, false), false)
  assert.equal(shouldRequireOnlinePaymentReactivation(false, true), false)
  assert.equal(shouldRequireOnlinePaymentReactivation(true, true), false)
  assert.equal(shouldRequireOnlinePaymentReactivation(true, false), true)
})

test('il fallback effettivo non sovrascrive la preferenza e attende conferma dopo una sospensione', () => {
  assert.equal(getEffectivePaymentMode('online', false, false), 'in_person')
  assert.equal(getEffectivePaymentMode('online', true, true), 'in_person')
  assert.equal(getEffectivePaymentMode('online', true, false), 'online')
  assert.equal(getEffectivePaymentMode('client_choice', true, true), 'in_person')
  assert.equal(getEffectivePaymentMode('client_choice', true, false), 'client_choice')
  assert.equal(getEffectivePaymentMode('in_person', false, true), 'in_person')
})
