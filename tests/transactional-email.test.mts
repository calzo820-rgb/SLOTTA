import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deliverTransactionalEmail,
  EmailDeliveryError,
} from '../src/lib/emailDelivery.ts'

const payload = {
  from: 'Slotta <noreply@slotta.it>',
  to: 'cliente@example.com',
  subject: 'Conferma',
  text: 'Prenotazione confermata',
}

test('transactional email uses the deterministic idempotency key', async () => {
  const calls: unknown[] = []
  const data = await deliverTransactionalEmail(payload, 'booking-confirmed-12345678', {
    async send(_payload, options) {
      calls.push(options)
      return { data: { id: 'email_123' }, error: null }
    },
  })

  assert.deepEqual(data, { id: 'email_123' })
  assert.deepEqual(calls, [{ idempotencyKey: 'booking-confirmed-12345678' }])
})

test('transactional email retries a returned Resend error with the same key', async () => {
  const keys: string[] = []
  await deliverTransactionalEmail(payload, 'booking-confirmed-87654321', {
    async send(_payload, options) {
      keys.push(options.idempotencyKey)
      if (keys.length === 1) {
        return { data: null, error: { name: 'rate_limit_exceeded', message: 'retry' } }
      }
      return { data: { id: 'email_456' }, error: null }
    },
  })

  assert.deepEqual(keys, ['booking-confirmed-87654321', 'booking-confirmed-87654321'])
})

test('transactional email reports a stable error after two failed attempts', async () => {
  let attempts = 0
  await assert.rejects(
    deliverTransactionalEmail(payload, 'booking-confirmed-abcdefgh', {
      async send() {
        attempts += 1
        throw new Error('provider details must not escape')
      },
    }),
    EmailDeliveryError,
  )
  assert.equal(attempts, 2)
})

test('transactional email rejects unsafe idempotency keys before sending', async () => {
  let called = false
  await assert.rejects(
    deliverTransactionalEmail(payload, 'customer@example.com', {
      async send() {
        called = true
        return { data: { id: 'email_789' }, error: null }
      },
    }),
    /Invalid transactional email idempotency key/,
  )
  assert.equal(called, false)
})
