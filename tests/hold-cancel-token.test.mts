import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  createHoldCancelToken,
  verifyHoldCancelToken,
} from '../src/lib/holdCancelToken.ts'

const holdId = '7b8f9020-76b6-4de4-961e-fcf4a96db821'
const otherHoldId = '11ed4cb4-8db5-4405-96a5-d6d42cf1bf4e'
const secret = 'sk_test_not_a_real_key'
const expiresAt = new Date('2030-01-01T00:00:00.000Z')
const cancelRoute = readFileSync(
  new URL('../src/app/api/service-checkout-cancel/route.ts', import.meta.url),
  'utf8',
)

test('accepts a valid hold cancellation token before expiry', () => {
  const token = createHoldCancelToken(holdId, expiresAt, secret)
  assert.equal(
    verifyHoldCancelToken(holdId, token, secret, Date.parse('2029-12-31T23:59:59Z')),
    true,
  )
})

test('binds the token to the hold and secret', () => {
  const token = createHoldCancelToken(holdId, expiresAt, secret)
  assert.equal(verifyHoldCancelToken(otherHoldId, token, secret), false)
  assert.equal(verifyHoldCancelToken(holdId, token, 'different-secret'), false)
})

test('rejects expired, malformed and tampered tokens', () => {
  const token = createHoldCancelToken(holdId, expiresAt, secret)
  const replacement = token.endsWith('x') ? 'y' : 'x'
  assert.equal(
    verifyHoldCancelToken(holdId, token, secret, Date.parse('2030-01-01T00:00:01Z')),
    false,
  )
  assert.equal(verifyHoldCancelToken(holdId, 'invalid', secret), false)
  assert.equal(
    verifyHoldCancelToken(holdId, `${token.slice(0, -1)}${replacement}`, secret),
    false,
  )
})

test('requires guarded cancellation requests before updating holds', () => {
  assert.match(cancelRoute, /readJsonBody\(req, 4_096\)/)
  assert.match(cancelRoute, /enforceRateLimit\(req, 'service-checkout-cancel'/)
  assert.match(cancelRoute, /isUuid\(holdId\)/)
  assert.match(cancelRoute, /verifyHoldCancelToken\(holdId, token, secret\)/)
  assert.match(cancelRoute, /\.eq\('status', 'pending'\)/)
})
