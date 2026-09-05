const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/

export function isValidBookingDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function bookingTimeToMinutes(value: string): number | null {
  const match = TIME_RE.exec(value)
  if (!match) return null

  return Number(match[1]) * 60 + Number(match[2])
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function hasValidBookingCustomer(input: {
  name: string
  email: string
  phone: string
  note: string | null
}): boolean {
  return (
    input.name.trim().length >= 2 &&
    input.name.trim().length <= 120 &&
    input.email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) &&
    input.phone.length <= 40 &&
    input.phone.replace(/\D/g, '').length >= 8 &&
    (input.note === null || input.note.length <= 1_000)
  )
}

export function getNowInTimeZone(
  timeZone: string,
  now = new Date(),
): { date: string; minutes: number } {
  let formatter: Intl.DateTimeFormat

  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Rome',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  }

  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  )

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}
