import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  getManagerSetupSteps,
  hasManagerBookableSlotOnDate,
} from '../src/lib/managerOnboarding.ts'

const root = new URL('../src/', import.meta.url)
const readSource = (path: string) => readFileSync(new URL(path, root), 'utf8')

const tenantHours = [{
  dow: 2,
  is_closed: false,
  open_time_am: '09:00:00',
  close_time_am: '12:00:00',
  pm_enabled: false,
}]
const staff = [{ id: 'staff-1', is_active: true, position: 0 }]
const staffHours = [{
  staff_id: 'staff-1',
  dow: 2,
  is_closed: false,
  open_time_am: '09:00:00',
  close_time_am: '12:00:00',
  pm_enabled: false,
}]
const services = [{
  id: 'service-1',
  name: 'Taglio',
  duration_minutes: 60,
  price_cents: 2500,
  is_active: true,
}]

test('completes the first three steps only from valid saved configuration', () => {
  const steps = getManagerSetupSteps({ tenantHours, staff, staffHours, services })
  assert.deepEqual(steps.map(step => step.complete), [true, true, true])
})

test('rejects missing or malformed hours instead of accepting scheduling fallbacks', () => {
  const steps = getManagerSetupSteps({
    tenantHours: [{ dow: 2, is_closed: false, open_time_am: null, close_time_am: null }],
    staff,
    staffHours,
    services,
  })
  assert.equal(steps.find(step => step.id === 'hours')?.complete, false)
  assert.equal(steps.find(step => step.id === 'staff')?.complete, false)
})

test('requires an active operator with a valid overlapping schedule', () => {
  const inactive = getManagerSetupSteps({
    tenantHours,
    staff: [{ ...staff[0], is_active: false }],
    staffHours,
    services,
  })
  const noOverlap = getManagerSetupSteps({
    tenantHours,
    staff,
    staffHours: [{ ...staffHours[0], open_time_am: '13:00:00', close_time_am: '17:00:00' }],
    services,
  })
  assert.equal(inactive.find(step => step.id === 'staff')?.complete, false)
  assert.equal(noOverlap.find(step => step.id === 'staff')?.complete, false)
})

test('requires an active bookable service with a name, positive duration, and valid price', () => {
  const steps = getManagerSetupSteps({
    tenantHours,
    staff,
    staffHours,
    services: [{ ...services[0], name: '  ', duration_minutes: 0 }],
  })
  assert.equal(steps.find(step => step.id === 'services')?.complete, false)
})

test('finds a bookable slot and treats a staff-specific closure as applying to that staff only', () => {
  const base = {
    date: '2026-11-24',
    currentDate: '2026-11-23',
    currentMinutes: 600,
    serviceId: 'service-1',
    durationByServiceId: { 'service-1': 60 },
    settings: { slot_minutes: 30, service_staff_count: 1, lead_minutes: 30 },
    tenantHours: tenantHours[0],
    staffHours,
    closures: [],
    busySlots: [],
  }
  assert.equal(hasManagerBookableSlotOnDate({ ...base, staff }), true)
  assert.equal(
    hasManagerBookableSlotOnDate({
      ...base,
      staff: [{ ...staff[0], id: 'staff-1' }, { id: 'staff-2', is_active: true, position: 1 }],
      staffHours: [...staffHours, { ...staffHours[0], staff_id: 'staff-2' }],
      closures: [{ staff_id: 'staff-1', closure_type: 'staff', all_day: true, start_time: null, end_time: null }],
    }),
    true,
  )
})

test('no availability is a separate result and does not change the completion rules', () => {
  const available = hasManagerBookableSlotOnDate({
    date: '2026-11-24',
    currentDate: '2026-11-23',
    currentMinutes: 600,
    serviceId: 'service-1',
    durationByServiceId: { 'service-1': 60 },
    settings: { slot_minutes: 30, service_staff_count: 1, lead_minutes: 30 },
    staff,
    tenantHours: tenantHours[0],
    staffHours,
    closures: [{ staff_id: null, closure_type: 'salon', all_day: true, start_time: null, end_time: null }],
    busySlots: [],
  })
  assert.equal(available, false)
  assert.deepEqual(
    getManagerSetupSteps({ tenantHours, staff, staffHours, services }).map(step => step.complete),
    [true, true, true],
  )
})

test('gates ordinary admin pages while keeping setup sections reachable', () => {
  const adminPage = readSource('app/admin/page.tsx')
  const guard = readSource('lib/managerOnboardingServer.ts')
  const api = readSource('app/api/admin/setup-progress/route.ts')
  assert.match(adminPage, /redirect\('\/admin\/setup'\)/)
  assert.match(guard, /'\/admin\/hours'/)
  assert.match(guard, /'\/admin\/staff'/)
  assert.match(guard, /'\/admin\/services'/)
  assert.match(api, /membership\.role !== 'owner'/)
  assert.match(api, /completeManagerSetup\(tenantId/)
})
