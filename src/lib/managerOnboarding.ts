import {
  buildSlots,
  eligibleStaffForWindow,
  isWindowWithinTenantAvailability,
  timeStrToMinutes,
  type AvailabilityClosure,
  type AvailabilityHours,
} from './bookingSlots.ts'

export type SetupStepId = 'hours' | 'staff' | 'services'

export type SetupStep = {
  id: SetupStepId
  complete: boolean
}

export type SetupHours = AvailabilityHours & {
  dow: number
}

export type SetupStaff = {
  id: string
  is_active: boolean | null
  position: number
}

export type SetupStaffHours = AvailabilityHours & {
  staff_id: string
  dow: number
}

export type SetupService = {
  id: string
  name: string | null
  duration_minutes: number | null
  price_cents: number | null
  is_active: boolean | null
}

function strictTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const match = /^(?:([01]\d|2[0-3])):([0-5]\d)(?::[0-5]\d)?$/.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function validSegments(
  row: (AvailabilityHours & { dow?: number }) | null | undefined,
  staff = false,
) {
  if (!row || row.is_closed === true) return []

  const amOpen = strictTimeToMinutes(
    row.open_time_am ?? (!staff ? row.open_time : null),
  )
  const amClose = strictTimeToMinutes(
    row.close_time_am ?? (!staff ? row.close_time : null),
  )
  const result: Array<{ start: number; end: number }> = []
  if (amOpen !== null && amClose !== null && amClose > amOpen) {
    result.push({ start: amOpen, end: amClose })
  }

  if (Boolean(row.pm_enabled ?? row.has_split ?? false)) {
    const pmOpen = strictTimeToMinutes(row.open_time_pm)
    const pmClose = strictTimeToMinutes(row.close_time_pm)
    if (pmOpen !== null && pmClose !== null && pmClose > pmOpen) {
      result.push({ start: pmOpen, end: pmClose })
    }
  }

  return result
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return Math.max(a.start, b.start) < Math.min(a.end, b.end)
}

export function getManagerSetupSteps(input: {
  tenantHours: SetupHours[]
  staff: SetupStaff[]
  staffHours: SetupStaffHours[]
  services: SetupService[]
}): SetupStep[] {
  const { tenantHours, staff, staffHours, services } = input
  const validTenantHours = tenantHours.filter(row => validSegments(row).length > 0)
  const tenantDays = new Set(validTenantHours.map(row => row.dow))

  const hasCompatibleStaff = staff.some(member => {
    if (member.is_active !== true) return false

    return staffHours.some(row => {
      if (row.staff_id !== member.id || !tenantDays.has(row.dow)) return false
      const salon = validSegments(tenantHours.find(hour => hour.dow === row.dow))
      const operator = validSegments(row, true)
      return salon.some(salonSegment =>
        operator.some(operatorSegment => overlaps(salonSegment, operatorSegment)),
      )
    })
  })

  const hasBookableService = services.some(service =>
    service.is_active === true &&
    Boolean(service.name?.trim()) &&
    Number.isInteger(service.duration_minutes) &&
    Number(service.duration_minutes) > 0 &&
    Number.isInteger(service.price_cents) &&
    Number(service.price_cents) >= 0,
  )

  return [
    { id: 'hours', complete: validTenantHours.length > 0 },
    { id: 'staff', complete: hasCompatibleStaff },
    { id: 'services', complete: hasBookableService },
  ]
}

export type SetupAvailabilitySettings = {
  slot_minutes?: number | null
  service_staff_count?: number | null
  lead_minutes?: number | null
}

export type SetupBusySlot = {
  service_id: string
  staff_id: string | null
  booking_time: string
}

export function hasManagerBookableSlotOnDate(input: {
  date: string
  currentDate: string
  currentMinutes: number
  serviceId: string
  durationByServiceId: Record<string, number>
  settings: SetupAvailabilitySettings | null
  staff: SetupStaff[]
  tenantHours: SetupHours | null
  staffHours: SetupStaffHours[]
  closures: AvailabilityClosure[]
  busySlots: SetupBusySlot[]
}) {
  const {
    date,
    currentDate,
    currentMinutes,
    serviceId,
    durationByServiceId,
    settings,
    staff,
    tenantHours,
    staffHours,
    closures,
    busySlots,
  } = input
  if (!tenantHours || staff.length === 0) return false

  const tenantSegments = validSegments(tenantHours)
  if (!tenantSegments.length) return false

  const duration = durationByServiceId[serviceId]
  if (!Number.isFinite(duration) || duration <= 0) return false
  const slotMinutes = Number(settings?.slot_minutes)
  const maxConcurrent = Number(settings?.service_staff_count)
  const leadMinutes = Number(settings?.lead_minutes)
  const intervals = busySlots.flatMap(slot => {
    const start = strictTimeToMinutes(slot.booking_time)
    if (start === null) return []
    const occupiedDuration = durationByServiceId[slot.service_id] || 60
    return [{ start, end: start + occupiedDuration }]
  })

  const slots = buildSlots({
    date,
    segments: tenantSegments,
    slotMinutes: Number.isFinite(slotMinutes) && slotMinutes > 0 ? slotMinutes : 30,
    selectedDuration: duration,
    intervals,
    staffCount: Number.isFinite(maxConcurrent) && maxConcurrent > 0 ? maxConcurrent : 1,
    leadMinutes: Number.isFinite(leadMinutes) && leadMinutes >= 0 ? leadMinutes : 30,
    currentDate,
    currentMinutes,
  })
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()

  return slots.some(slot => {
    if (slot.disabled) return false
    const start = timeStrToMinutes(slot.time)
    const end = start + duration
    if (!isWindowWithinTenantAvailability({ tenantHours, closures, start, end })) {
      return false
    }

    const scheduledStaff = staff.filter(member => {
      if (member.is_active !== true) return false
      const hours = staffHours.find(row => row.staff_id === member.id && row.dow === dow)
      return validSegments(hours, true).some(staffSegment =>
        tenantSegments.some(tenantSegment => overlaps(staffSegment, tenantSegment)),
      )
    })
    const eligible = eligibleStaffForWindow({
      staff: scheduledStaff,
      staffHours,
      closures,
      dow,
      start,
      end,
      requestedStaffId: null,
    })

    return eligible.some(member =>
      busySlots.every(busy => {
        if (busy.staff_id !== member.id) return true
        const busyStart = strictTimeToMinutes(busy.booking_time)
        if (busyStart === null) return true
        const busyEnd = busyStart + (durationByServiceId[busy.service_id] || 60)
        return start >= busyEnd || end <= busyStart
      }),
    )
  })
}
