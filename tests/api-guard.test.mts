import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hashRateLimitIdentity,
  readJsonBody,
} from '../src/lib/apiGuard.ts'

test('accepts a small JSON object', async () => {
  const request = new Request('https://slotta.it/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  })
  assert.deepEqual(await readJsonBody(request, 100), { ok: true })
})

test('rejects malformed, array and oversized JSON bodies', async () => {
  const malformed = new Request('https://slotta.it/api/test', { method: 'POST', body: '{' })
  const array = new Request('https://slotta.it/api/test', { method: 'POST', body: '[]' })
  const oversized = new Request('https://slotta.it/api/test', { method: 'POST', body: JSON.stringify({ value: 'x'.repeat(100) }) })

  assert.equal(await readJsonBody(malformed), null)
  assert.equal(await readJsonBody(array), null)
  assert.equal(await readJsonBody(oversized, 20), null)
})

test('hashes rate limit identities without retaining raw IP addresses', () => {
  const first = hashRateLimitIdentity('service-book', '203.0.113.10')
  const same = hashRateLimitIdentity('service-book', '203.0.113.10')
  const otherScope = hashRateLimitIdentity('service-checkout', '203.0.113.10')

  assert.match(first, /^[0-9a-f]{64}$/)
  assert.equal(first, same)
  assert.notEqual(first, otherScope)
  assert.doesNotMatch(first, /203\.0\.113\.10/)
})
