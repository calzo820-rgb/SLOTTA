export type SlotReason = 'past' | 'busy' | 'outside_segment'

export type Slot = {
  time: string
  disabled: boolean
  reason?: SlotReason
}

export function timeStrToMinutes(s: string): number {
  const parts = String(s || '').split(':')
  const h = parseInt(parts[0] || '0', 10)
  const m = parseInt(parts[1] || '0', 10)
  return h * 60 + m
}

export function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function getSlotReasonLabel(reason?: SlotReason) {
  switch (reason) {
    case 'past':
      return 'Passato'
    case 'busy':
      return 'Occupato'
    case 'outside_segment':
      return 'Fuori fascia'
    default:
      return ''
  }
}

export function getLocalNowMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

export function isSameLocalDay(dateStr: string) {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return dateStr === `${yyyy}-${mm}-${dd}`
}

export function buildSegments(params: {
  selectedStaffId: 'any' | string
  tenantHours: {
    open_time_am?: string | null
    close_time_am?: string | null
    pm_enabled?: boolean | null
    has_split?: boolean | null
    open_time_pm?: string | null
    close_time_pm?: string | null
    open_time?: string | null
    close_time?: string | null
  }
  selectedStaffHours?: {
    open_time_am?: string | null
    close_time_am?: string | null
    pm_enabled?: boolean | null
    open_time_pm?: string | null
    close_time_pm?: string | null
    is_closed?: boolean | null
  } | null
}) {
  const { selectedStaffId, tenantHours, selectedStaffHours } = params

  const segments: Array<{ start: number; end: number }> = []

  if (selectedStaffId !== 'any') {
    if (!selectedStaffHours || selectedStaffHours.is_closed) {
      return segments
    }

    const staffAmOpen = timeStrToMinutes(selectedStaffHours.open_time_am || '09:00:00')
    const staffAmClose = timeStrToMinutes(selectedStaffHours.close_time_am || '12:30:00')

    if (staffAmClose > staffAmOpen) {
      segments.push({ start: staffAmOpen, end: staffAmClose })
    }

    const staffPmEnabled = Boolean(selectedStaffHours.pm_enabled ?? false)
    if (staffPmEnabled) {
      const staffPmOpen = timeStrToMinutes(selectedStaffHours.open_time_pm || '15:00:00')
      const staffPmClose = timeStrToMinutes(selectedStaffHours.close_time_pm || '19:00:00')

      if (staffPmClose > staffPmOpen) {
        segments.push({ start: staffPmOpen, end: staffPmClose })
      }
    }

    return segments
  }

  const amOpenStr = (tenantHours.open_time_am || tenantHours.open_time || '09:00:00') as string
  const amCloseStr = (tenantHours.close_time_am || tenantHours.close_time || '19:00:00') as string

  const amStart = timeStrToMinutes(amOpenStr)
  const amEnd = timeStrToMinutes(amCloseStr)
  if (amEnd > amStart) {
    segments.push({ start: amStart, end: amEnd })
  }

  const pmEnabled = Boolean((tenantHours.pm_enabled ?? tenantHours.has_split) ?? false)
  if (pmEnabled) {
    const pmOpenStr = (tenantHours.open_time_pm || '15:00:00') as string
    const pmCloseStr = (tenantHours.close_time_pm || '19:00:00') as string

    const pmStart = timeStrToMinutes(pmOpenStr)
    const pmEnd = timeStrToMinutes(pmCloseStr)

    if (pmEnd > pmStart) {
      segments.push({ start: pmStart, end: pmEnd })
    }
  }

  return segments
}

export function buildSlots(params: {
  date: string
  segments: Array<{ start: number; end: number }>
  slotMinutes: number
  selectedDuration: number
  intervals: Array<{ start: number; end: number }>
  staffCount: number
  leadMinutes: number
}) {
  const { date, segments, slotMinutes, selectedDuration, intervals, staffCount, leadMinutes } = params

  const slotsTmp: Slot[] = []
  const isToday = isSameLocalDay(date)
  const nowMinutes = getLocalNowMinutes()

  for (const seg of segments) {
    for (let t = seg.start; t + slotMinutes <= seg.end; t += slotMinutes) {
      const startCandidate = t
      const endCandidate = t + selectedDuration

      if (endCandidate > seg.end) {
        slotsTmp.push({
          time: minutesToHHMM(t),
          disabled: true,
          reason: 'outside_segment',
        })
        continue
      }

      let overlapping = 0
      for (const iv of intervals) {
        if (startCandidate < iv.end && endCandidate > iv.start) {
          overlapping++
        }
      }

      const isPastOrTooSoon = isToday && startCandidate < nowMinutes + leadMinutes

      let reason: SlotReason | undefined
      if (isPastOrTooSoon) {
        reason = 'past'
      } else if (overlapping >= staffCount) {
        reason = 'busy'
      }

      slotsTmp.push({
        time: minutesToHHMM(t),
        disabled: !!reason,
        reason,
      })
    }
  }

  return slotsTmp
}