import type { Booking } from './types'

export function fmtTime(t: string) {
  const parts = String(t || '').split(':')
  return `${parts[0] || '00'}:${parts[1] || '00'}`
}

export function timeToMinutes(t: string) {
  const parts = String(t || '').split(':')
  const h = parseInt(parts[0] || '0', 10)
  const m = parseInt(parts[1] || '0', 10)
  return h * 60 + m
}

export function fmtDateShort(d: string) {
  const date = new Date(`${d}T00:00:00`)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

export function fmtDateLong(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function dateToYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function statusChip(status: Booking['status']) {
  if (status === 'pending') {
    return {
      label: 'In attesa',
      cls: 'bg-amber-100 text-amber-800 border-amber-200',
    }
  }

  if (status === 'confirmed') {
    return {
      label: 'Confermata',
      cls: 'bg-green-100 text-green-800 border-green-200',
    }
  }

  if (status === 'done') {
    return {
      label: 'Confermata',
      cls: 'bg-green-100 text-green-800 border-green-200',
    }
  }

  return {
    label: 'Cancellata',
    cls: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  }
}

export function paymentChip(paymentStatus?: 'unpaid' | 'paid' | null) {
  if (paymentStatus === 'paid') {
    return {
      label: 'Pagato',
      cls: 'bg-green-100 text-green-800 border-green-200',
    }
  }

  return {
    label: 'Da pagare',
    cls: 'bg-orange-100 text-orange-800 border-orange-200',
  }
}

export function calendarBookingVisual(b: Booking) {
  if (b.status === 'cancelled') {
    return {
      cls: 'border-red-300 bg-red-100',
    }
  }

  if (b.status === 'pending') {
    return {
      cls: 'border-amber-300 bg-amber-100',
    }
  }

  if (b.manager_seen_at == null) {
    return {
      cls: 'border-teal-400 bg-teal-100 ring-2 ring-teal-300/60',
    }
  }

  if (b.status === 'confirmed' && b.payment_status === 'paid') {
    return {
      cls: 'border-emerald-300 bg-emerald-100',
    }
  }

  return {
    cls:
      'border-emerald-300 bg-[linear-gradient(135deg,#D1FAE5_0%,#D1FAE5_50%,#FEF3C7_50%,#FEF3C7_100%)]',
  }
}