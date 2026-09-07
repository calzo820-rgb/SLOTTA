import assert from 'node:assert/strict'
import test from 'node:test'
import { observeApiRoute } from '../src/lib/apiObservability.ts'

test('adds a request ID to successful responses without changing their body', async () => {
  const handler = observeApiRoute('/api/test', async () => Response.json({ ok: true }))
  const response = await handler(new Request('https://slotta.it/api/test'))

  assert.match(response.headers.get('x-request-id') || '', /^[0-9a-f-]{36}$/)
  assert.deepEqual(await response.json(), { ok: true })
})

test('returns stable public error codes and correlates body and header', async () => {
  const handler = observeApiRoute('/api/test', async () =>
    Response.json({ error: 'No.' }, { status: 403 }),
  )
  const response = await handler(
    new Request('https://slotta.it/api/test', {
      headers: { 'x-request-id': 'client-request-123' },
    }),
  )
  const body = await response.json()

  assert.equal(response.headers.get('x-request-id'), 'client-request-123')
  assert.equal(body.request_id, 'client-request-123')
  assert.equal(body.error_code, 'FORBIDDEN')
})

test('does not expose thrown error messages', async () => {
  const handler = observeApiRoute('/api/test', async () => {
    throw new Error('customer@example.com must never appear')
  })
  const response = await handler(new Request('https://slotta.it/api/test'))
  const body = await response.json()

  assert.equal(response.status, 500)
  assert.equal(body.error_code, 'INTERNAL_ERROR')
  assert.doesNotMatch(JSON.stringify(body), /customer@example\.com/)
})
