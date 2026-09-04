import assert from 'node:assert/strict'
import test from 'node:test'

import {
  fmtTime,
  minutesToTime,
  overlaps,
  timeStrToMinutes,
} from '../src/app/admin/service-bookings/utils/booking-format.ts'

test('formats database times for display', () => {
  assert.equal(fmtTime('14:05:00'), '14:05')
  assert.equal(minutesToTime(timeStrToMinutes('14:05:00')), '14:05')
})

test('detects real overlaps but allows adjacent appointments', () => {
  assert.equal(overlaps(540, 600, 570, 630), true)
  assert.equal(overlaps(540, 600, 600, 660), false)
  assert.equal(overlaps(600, 660, 540, 600), false)
})
