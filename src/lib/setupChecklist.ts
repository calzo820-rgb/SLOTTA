import {
  buildSegments,
  buildSlots,
  eligibleStaffForWindow,
  isWindowWithinTenantAvailability,
  timeStrToMinutes,
  type AvailabilityClosure,
  type AvailabilityHours,
} from './bookingSlots.ts'

export type SetupStepId = 'profile' | 'hours' | 'staff' | 'services'

export type SetupStep = {
  id: SetupStepId
  complete: boolean
}

export type SetupTenant = {
  name: string | null
  slug: string | null
  address: string | null
  contact_email: string | null
  phone: string | null
  whatsapp_phone: string | null
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
  name: string
  duration_minutes: number | null
  price_cents: number | null
  is_active: boolean | null
}

export function hasValidAvailabilitySegments(
  hours: AvailabilityHours | null | undefined,
  staffId: 'any' | string = 'any',
) {
  if (!hours || hours.is_closed) return false

  return buildSegments({
    selectedStaffId: staffId,
    tenantHours: hours,
    selectedStaffHours: staffId === 'any' ? undefined : hours,
  }).some(
    segment =>
      Number.isFinite(segment.start) &&
      Number.isFinite(segment.end) &&
      segment.start >= 0 &&
      segment.end <= 24 * 60 &&
      segment.end > segment.start,
  )
}

export function getSetupSteps(input: {
  tenant: SetupTenant | null
  tenantHours: SetupHours[]
  staff: SetupStaff[]
  staffHours: SetupStaffHours[]
  services: SetupService[]
}): SetupStep[] {
  const { tenant, tenantHours, staff, staffHours, services } = input
  const validTenantDays = new Set(
    tenantHours
      .filter(row => hasValidAvailabilitySegments(row))
      .map(row => row.dow),
  )

  const hasCompatibleStaff = staff.some(member => {
    if (member.is_active === false) return false

    return staffHours.some(row => {
      if (row.staff_id !== member.id || !validTenantDays.has(row.dow)) {
        return false
      }

      if (!hasValidAvailabilitySegments(row, member.id)) return false

      const salonSegments = buildSegments({
        selectedStaffId: 'any',
        tenantHours: tenantHours.find(hour => hour.dow === row.dow) || {},
      })
      const operatorSegments = buildSegments({
        selectedStaffId: member.id,
        tenantHours: {},
        selectedStaffHours: row,
      })

      return salonSegments.some(salon =>
        operatorSegments.some(
          operator =>
            Math.max(salon.start, operator.start) <
            Math.min(salon.end, operator.end),
        ),
      )
    })
  })

  return [
    {
      id: 'profile',
      complete: Boolean(
        tenant?.name?.trim() &&
          tenant.slug?.trim() &&
          tenant.address?.trim() &&
          (tenant.contact_email?.trim() ||
            tenant.phone?.trim() ||
            tenant.whatsapp_phone?.trim()),
      ),
    },
    {
      id: 'hours',
      complete: validTenantDays.size > 0,
    },
    {
      id: 'staff',
      complete: hasCompatibleStaff,
    },
    {
      id: 'services',
      complete: services.some(
        service =>
          service.is_active !== false &&
          Boolean(service.name?.trim()) &&
          Number.isFinite(Number(service.duration_minutes)) &&
          Number(service.duration_minutes) > 0 &&
          service.price_cents !== null &&
          Number.isFinite(Number(service.price_cents)) &&
          Number(service.price_cents) >= 0,
      ),
    },
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

export function hasBookableSlotOnDate(input: {
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

  if (!tenantHours || tenantHours.is_closed || staff.length === 0) return false

  const selectedDuration = durationByServiceId[serviceId] || 60
  const slotMinutes =
    settings?.slot_minutes && settings.slot_minutes > 0
      ? settings.slot_minutes
      : 30
  const staffCount =
    settings?.service_staff_count && settings.service_staff_count > 0
      ? settings.service_staff_count
      : 1
  const leadMinutes =
    typeof settings?.lead_minutes === 'number' && settings.lead_minutes >= 0
      ? settings.lead_minutes
      : 30
  const segments = buildSegments({
    selectedStaffId: 'any',
    tenantHours,
  })
  const intervals = busySlots.map(slot => {
    const start = timeStrToMinutes(slot.booking_time)
    return {
      start,
      end: start + (durationByServiceId[slot.service_id] || 60),
    }
  })

  closures.forEach(closure => {
    const start = closure.all_day
      ? 0
      : timeStrToMinutes(closure.start_time || '00:00')
    const end = closure.all_day
      ? 24 * 60
      : timeStrToMinutes(closure.end_time || '23:59')

    if (closure.closure_type === 'salon' || closure.closure_type === 'staff') {
      for (let index = 0; index < staffCount; index += 1) {
        intervals.push({ start, end })
      }
    }
  })

  const slots = buildSlots({
    date,
    segments,
    slotMinutes,
    selectedDuration,
    intervals,
    staffCount,
    leadMinutes,
    currentDate,
    currentMinutes,
  })
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()

  return slots.some(slot => {
    if (slot.disabled) return false

    const start = timeStrToMinutes(slot.time)
    const end = start + selectedDuration
    if (
      !isWindowWithinTenantAvailability({
        tenantHours,
        closures,
        start,
        end,
      })
    ) {
      return false
    }

    const eligibleStaff = eligibleStaffForWindow({
      staff,
      staffHours,
      closures,
      dow,
      start,
      end,
      requestedStaffId: null,
    })

    return eligibleStaff.some(member =>
      busySlots.every(busy => {
        if (busy.staff_id !== member.id) return true
        const busyStart = timeStrToMinutes(busy.booking_time)
        const busyEnd =
          busyStart + (durationByServiceId[busy.service_id] || 60)
        return start >= busyEnd || end <= busyStart
      }),
    )
  })
}
