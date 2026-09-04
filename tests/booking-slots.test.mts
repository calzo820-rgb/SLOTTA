import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSegments,
  buildSlots,
  minutesToHHMM,
  timeStrToMinutes,
} from '../src/lib/bookingSlots.ts'

test('converts booking times without losing minutes', () => {
  assert.equal(timeStrToMinutes('09:30:00'), 570)
  assert.equal(minutesToHHMM(570), '09:30')
})

test('builds both opening segments for a split business day', () => {
  assert.deepEqual(
    buildSegments({
      selectedStaffId: 'any',
      tenantHours: {
        open_time_am: '09:00:00',
        close_time_am: '12:30:00',
        pm_enabled: true,
        open_time_pm: '15:00:00',
        close_time_pm: '19:00:00',
      },
    }),
    [
      { start: 540, end: 750 },
      { start: 900, end: 1140 },
    ],
  )
})

test('returns no availability for a closed selected operator', () => {
  assert.deepEqual(
    buildSegments({
      selectedStaffId: 'staff-1',
      tenantHours: {},
      selectedStaffHours: { is_closed: true },
    }),
    [],
  )
})

test('disables an occupied slot when all operators are busy', () => {
  const slots = buildSlots({
    date: '2099-01-01',
    segments: [{ start: 540, end: 660 }],
    slotMinutes: 30,
    selectedDuration: 60,
    intervals: [{ start: 540, end: 600 }],
    staffCount: 1,
    leadMinutes: 0,
  })

  assert.deepEqual(slots[0], {
    time: '09:00',
    disabled: true,
    reason: 'busy',
  })
  assert.equal(slots[2].disabled, false)
})

test('keeps a slot available while capacity remains', () => {
  const [slot] = buildSlots({
    date: '2099-01-01',
    segments: [{ start: 540, end: 600 }],
    slotMinutes: 30,
    selectedDuration: 30,
    intervals: [{ start: 540, end: 570 }],
    staffCount: 2,
    leadMinutes: 0,
  })

  assert.deepEqual(slot, { time: '09:00', disabled: false, reason: undefined })
})

test('marks starts that cannot fit the service duration', () => {
  const slots = buildSlots({
    date: '2099-01-01',
    segments: [{ start: 540, end: 630 }],
    slotMinutes: 30,
    selectedDuration: 60,
    intervals: [],
    staffCount: 1,
    leadMinutes: 0,
  })

  assert.deepEqual(slots.at(-1), {
    time: '10:00',
    disabled: true,
    reason: 'outside_segment',
  })
})
