import type { Booking, Service } from '../types'
export function fmtTime(t: string) {
  const parts = String(t || '').split(':')
  return `${parts[0] || '00'}:${parts[1] || '00'}`
}

export function fmtDate(d: string) {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString('it-IT')
  } catch {
    return d
  }
}

export function euro(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2)
}

export function timeStrToMinutes(s: string): number {
  const parts = String(s || '').split(':')
  const h = parseInt(parts[0] || '0', 10)
  const m = parseInt(parts[1] || '0', 10)
  return h * 60 + m
}

export function minutesToTime(min: number) {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB
}
export function buildGoogleCalendarLink(booking: Booking, service?: Service): string {
  const duration = service?.duration_minutes || 60
  const datePlain = booking.booking_date.replace(/-/g, '')

  const [hh, mm] = String(booking.booking_time || '00:00').split(':')
  const startMinutes = timeStrToMinutes(booking.booking_time)
  const endMinutes = startMinutes + duration

  const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0')
  const endM = String(endMinutes % 60).padStart(2, '0')

  const startStr = `${datePlain}T${(hh || '00')}${(mm || '00')}00`
  const endStr = `${datePlain}T${endH}${endM}00`

  const title = encodeURIComponent(`Appuntamento: ${service?.name || 'servizio'}`)
  const details = encodeURIComponent(
    `Prenotazione presso il salone.\nCliente: ${booking.customer_name || ''}`,
  )

  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}`
}