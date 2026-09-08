import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { billingStatusLabel, canUseBillingPortal, normalizeBillingStatus, stripeReferenceId, subscriptionPeriodEnd } from '../src/lib/billing.ts'

test('normalizes only supported billing states', () => {
  assert.equal(normalizeBillingStatus('active'), 'active')
  assert.equal(normalizeBillingStatus('unexpected'), 'incomplete')
  assert.equal(billingStatusLabel('past_due'), 'Pagamento da regolarizzare')
})

test('only Stripe customer identifiers can open the portal', () => {
  assert.equal(canUseBillingPortal('cus_123'), true)
  assert.equal(canUseBillingPortal('acct_123'), false)
  assert.equal(canUseBillingPortal(null), false)
})

test('keeps SaaS subscription checkout separate from connected-account payments', () => {
  const route = readFileSync(new URL('../src/app/api/billing/checkout/route.ts', import.meta.url), 'utf8')
  assert.match(route, /mode: 'subscription'/)
  assert.match(route, /STRIPE_BILLING_PRICE_ID/)
  assert.doesNotMatch(route, /stripeAccount/)
  assert.doesNotMatch(route, /stripe_connect_account_id/)
})

test('extracts safe Stripe references and subscription period dates', () => {
  assert.equal(stripeReferenceId('cus_123', 'cus_'), 'cus_123')
  assert.equal(stripeReferenceId({ id: 'sub_123' }, 'sub_'), 'sub_123')
  assert.equal(stripeReferenceId('acct_123', 'cus_'), null)
  assert.equal(subscriptionPeriodEnd({ items: { data: [
    { current_period_end: 1_800_000_000 },
    { current_period_end: 1_800_000_100 },
  ] } }), new Date(1_800_000_100_000).toISOString())
})

test('billing webhook uses its own signature and handles lifecycle events', () => {
  const route = readFileSync(new URL('../src/app/api/webhooks/stripe-billing/route.ts', import.meta.url), 'utf8')
  assert.match(route, /STRIPE_BILLING_WEBHOOK_SECRET/)
  assert.match(route, /customer\.subscription\.updated/)
  assert.match(route, /invoice\.payment_failed/)
  assert.match(route, /billing_grace_ends_at/)
  assert.doesNotMatch(route, /STRIPE_WEBHOOK_SECRET\b/)
})
