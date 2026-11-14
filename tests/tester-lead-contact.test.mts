import assert from 'node:assert/strict'
import test from 'node:test'
import { validateTesterLeadContact } from '../src/lib/testerLeadContact.ts'

test('email alone requires email and does not retain an unused phone', () => {
  assert.deepEqual(validateTesterLeadContact(['email'], 'persona@example.it', ''), {
    ok: true, contactMethods: ['email'], email: 'persona@example.it', phone: null,
  })
})

test('each phone channel requires and retains a valid phone number', () => {
  for (const method of ['whatsapp', 'sms', 'call']) {
    assert.deepEqual(validateTesterLeadContact([method], '', '333 123 4567'), {
      ok: true, contactMethods: [method], email: null, phone: '333 123 4567',
    })
  }
})

test('multiple channels can require and retain both contact details', () => {
  assert.deepEqual(validateTesterLeadContact(['email', 'whatsapp', 'sms', 'call'], ' persona@example.it ', '3331234567'), {
    ok: true, contactMethods: ['email', 'whatsapp', 'sms', 'call'], email: 'persona@example.it', phone: '3331234567',
  })
})

test('no selected channel is rejected', () => {
  assert.equal(validateTesterLeadContact([], '', '').ok, false)
})

test('invalid channels are rejected', () => {
  assert.equal(validateTesterLeadContact(['email', 'telegram'], 'persona@example.it', '').ok, false)
})

test('email channel rejects missing or malformed email', () => {
  for (const email of ['', 'not-an-email']) {
    const result = validateTesterLeadContact(['email'], email, '')
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.error, 'Inserisci un indirizzo email valido.')
  }
})

test('phone channels each reject missing or too-short phone', () => {
  for (const method of ['whatsapp', 'sms', 'call']) {
    for (const phone of ['', '1234567']) {
      const result = validateTesterLeadContact([method], '', phone)
      assert.equal(result.ok, false)
      if (!result.ok) assert.equal(result.error, 'Inserisci un numero di telefono valido.')
    }
  }
})

test('mixed email and phone channels require each applicable detail', () => {
  assert.equal(validateTesterLeadContact(['email', 'call'], '', '3331234567').ok, false)
  assert.equal(validateTesterLeadContact(['email', 'call'], 'persona@example.it', '').ok, false)
})

test('duplicate selections are normalized', () => {
  assert.deepEqual(validateTesterLeadContact(['sms', 'sms'], '', '3331234567'), {
    ok: true, contactMethods: ['sms'], email: null, phone: '3331234567',
  })
})

test('all non-empty channel combinations require exactly their applicable details', () => {
  const available = ['email', 'whatsapp', 'sms', 'call']
  for (let mask = 1; mask < 1 << available.length; mask += 1) {
    const methods = available.filter((_, index) => mask & (1 << index))
    const needsEmail = methods.includes('email')
    const needsPhone = methods.some(method => method !== 'email')
    const complete = validateTesterLeadContact(
      methods,
      needsEmail ? 'persona@example.it' : '',
      needsPhone ? '3331234567' : '',
    )
    assert.equal(complete.ok, true, `expected ${methods.join(',')} to accept applicable details`)

    if (needsEmail) {
      assert.equal(validateTesterLeadContact(methods, '', needsPhone ? '3331234567' : '').ok, false)
    }
    if (needsPhone) {
      assert.equal(validateTesterLeadContact(methods, needsEmail ? 'persona@example.it' : '', '').ok, false)
    }
  }
})
