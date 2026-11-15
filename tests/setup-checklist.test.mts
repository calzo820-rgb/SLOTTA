import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  getSetupSteps,
  hasBookableSlotOnDate,
} from '../src/lib/setupChecklist.ts'

const progressRoute = readFileSync(
  new URL('../src/app/api/admin/setup-progress/route.ts', import.meta.url),
  'utf8',
)
const bookingsPage = readFileSync(
  new URL('../src/app/admin/service-bookings/page.tsx', import.meta.url),
  'utf8',
)
const hoursPage = readFileSync(
  new URL('../src/app/admin/hours/page.tsx', import.meta.url),
  'utf8',
)

const tenantHours = {
  dow: 2,
  is_closed: false,
  open_time_am: '09:00:00',
  close_time_am: '12:00:00',
  pm_enabled: false,
  open_time_pm: null,
  close_time_pm: null,
}

const staff = [{ id: 'staff-1', is_active: true, position: 0 }]
const staffHours = [
  {
    staff_id: 'staff-1',
    dow: 2,
    is_closed: false,
    open_time_am: '09:00:00',
    close_time_am: '12:00:00',
    pm_enabled: false,
    open_time_pm: null,
    close_time_pm: null,
  },
]

test('marks the four setup steps complete from saved data', () => {
  const steps = getSetupSteps({
    tenant: {
      name: 'Attività demo',
      slug: 'attivita-demo',
      address: 'Via Roma 1',
      contact_email: 'demo@example.it',
      phone: null,
      whatsapp_phone: null,
    },
    tenantHours: [tenantHours],
    staff,
    staffHours,
    services: [
      { id: 'service-1', name: 'Taglio', duration_minutes: 60, price_cents: 2500, is_active: true },
    ],
  })

  assert.deepEqual(steps.map(step => step.complete), [true, true, true, true])
})

test('requires an active operator whose working hours overlap salon hours', () => {
  const steps = getSetupSteps({
    tenant: {
      name: 'Attività demo',
      slug: 'attivita-demo',
      address: 'Via Roma 1',
      contact_email: 'demo@example.it',
      phone: null,
      whatsapp_phone: null,
    },
    tenantHours: [tenantHours],
    staff: [{ ...staff[0], is_active: false }],
    staffHours,
    services: [
      { id: 'service-1', name: 'Taglio', duration_minutes: 60, price_cents: 2500, is_active: true },
    ],
  })

  assert.equal(steps.find(step => step.id === 'staff')?.complete, false)
})

test('finds a future bookable service slot using the shared slot functions', () => {
  const available = hasBookableSlotOnDate({
    date: '2026-11-17',
    currentDate: '2026-11-16',
    currentMinutes: 600,
    serviceId: 'service-1',
    durationByServiceId: { 'service-1': 60 },
    settings: { slot_minutes: 30, service_staff_count: 1, lead_minutes: 30 },
    staff,
    tenantHours,
    staffHours,
    closures: [],
    busySlots: [],
  })

  assert.equal(available, true)
})

test('returns no slot when the schedule is closed or occupied for the whole window', () => {
  const noStaffHours = hasBookableSlotOnDate({
    date: '2026-11-17',
    currentDate: '2026-11-16',
    currentMinutes: 600,
    serviceId: 'service-1',
    durationByServiceId: { 'service-1': 60 },
    settings: { slot_minutes: 30, service_staff_count: 1, lead_minutes: 30 },
    staff,
    tenantHours,
    staffHours: [],
    closures: [],
    busySlots: [],
  })
  const fullyOccupied = hasBookableSlotOnDate({
    date: '2026-11-17',
    currentDate: '2026-11-16',
    currentMinutes: 600,
    serviceId: 'service-1',
    durationByServiceId: { 'service-1': 60 },
    settings: { slot_minutes: 30, service_staff_count: 1, lead_minutes: 30 },
    staff,
    tenantHours,
    staffHours,
    closures: [],
    busySlots: [
      { service_id: 'service-1', staff_id: 'staff-1', booking_time: '09:00:00' },
      { service_id: 'service-1', staff_id: 'staff-1', booking_time: '10:00:00' },
      { service_id: 'service-1', staff_id: 'staff-1', booking_time: '11:00:00' },
    ],
  })

  assert.equal(noStaffHours, false)
  assert.equal(fullyOccupied, false)
})

test('limits setup progress data and dashboard checklist to the owner', () => {
  assert.match(progressRoute, /membership\.role !== 'owner'/)
  assert.match(progressRoute, /\.eq\('id', tenantId\)/)
  assert.match(bookingsPage, /showSetupChecklist=\{mem\.role === 'owner'\}/)
  assert.match(hoursPage, /showSetupGuide=\{mem\.role === 'owner'\}/)
})
