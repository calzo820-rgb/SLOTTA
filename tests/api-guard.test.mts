import assert from 'node:assert/strict'
import test from 'node:test'
import { readJsonBody } from '../src/lib/apiGuard.ts'

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
