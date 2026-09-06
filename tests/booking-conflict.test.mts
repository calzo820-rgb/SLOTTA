import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isStaffOverlapError,
  staffBusyResponseBody,
} from '../src/lib/bookingConflict.ts'

test('recognizes the database overlap error by SQLSTATE or marker', () => {
  assert.equal(isStaffOverlapError({ code: '23P01', message: 'conflict' }), true)
  assert.equal(
    isStaffOverlapError({ code: 'P0001', message: 'SLOTTA_STAFF_OVERLAP' }),
    true,
  )
  assert.equal(isStaffOverlapError(new Error('connection failed')), false)
  assert.equal(isStaffOverlapError(null), false)
})

test('returns a stable public conflict response', () => {
  assert.deepEqual(staffBusyResponseBody(), {
    error_code: 'STAFF_BUSY',
    error: 'Operatore già occupato in questo orario.',
  })
})

