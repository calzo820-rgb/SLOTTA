import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSegments,
  buildSlots,
  eligibleStaffForWindow,
  isWindowWithinTenantAvailability,
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

test('accepts a service only when its full duration fits opening hours', () => {
  const tenantHours = {
    open_time_am: '09:00:00',
    close_time_am: '12:30:00',
    pm_enabled: true,
    open_time_pm: '15:00:00',
    close_time_pm: '19:00:00',
  }

  assert.equal(
    isWindowWithinTenantAvailability({
      tenantHours,
      closures: [],
      start: 11 * 60 + 30,
      end: 12 * 60 + 30,
    }),
    true,
  )
  assert.equal(
    isWindowWithinTenantAvailability({
      tenantHours,
      closures: [],
      start: 12 * 60,
      end: 13 * 60,
    }),
    false,
  )
})

test('blocks salon closures but allows adjacent booking windows', () => {
  const params = {
    tenantHours: { open_time: '09:00:00', close_time: '19:00:00' },
    closures: [
      {
        staff_id: null,
        closure_type: 'salon',
        all_day: false,
        start_time: '12:00:00',
        end_time: '13:00:00',
      },
    ],
  }

  assert.equal(
    isWindowWithinTenantAvailability({ ...params, start: 11 * 60, end: 12 * 60 }),
    true,
  )
  assert.equal(
    isWindowWithinTenantAvailability({ ...params, start: 11 * 60 + 30, end: 12 * 60 + 30 }),
    false,
  )
})

test('filters operators by schedule, closure and explicit selection', () => {
  const staff = [
    { id: 'staff-1', position: 1 },
    { id: 'staff-2', position: 2 },
    { id: 'staff-3', position: 3 },
  ]
  const staffHours = [
    { staff_id: 'staff-1', dow: 1, open_time_am: '09:00:00', close_time_am: '13:00:00' },
    { staff_id: 'staff-2', dow: 1, open_time_am: '09:00:00', close_time_am: '13:00:00' },
    { staff_id: 'staff-3', dow: 1, is_closed: true },
  ]
  const closures = [
    {
      staff_id: 'staff-2',
      closure_type: 'staff',
      all_day: false,
      start_time: '10:00:00',
      end_time: '11:00:00',
    },
  ]

  assert.deepEqual(
    eligibleStaffForWindow({
      staff,
      staffHours,
      closures,
      dow: 1,
      start: 10 * 60,
      end: 10 * 60 + 30,
      requestedStaffId: null,
    }).map(member => member.id),
    ['staff-1'],
  )
  assert.deepEqual(
    eligibleStaffForWindow({
      staff,
      staffHours,
      closures: [],
      dow: 1,
      start: 10 * 60,
      end: 10 * 60 + 30,
      requestedStaffId: 'staff-2',
    }).map(member => member.id),
    ['staff-2'],
  )
})
