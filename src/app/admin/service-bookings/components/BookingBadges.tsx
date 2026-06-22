import React from 'react'
import type { Booking } from '../types'

export function Badge({
  children,
  tone = 'zinc',
}: {
  children: React.ReactNode
  tone?: 'zinc' | 'green' | 'amber' | 'red' | 'blue' | 'orange'
}) {
  const map: Record<string, string> = {
    zinc: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${map[tone]}`}
    >
      {children}
    </span>
  )
}

export function statusLabel(s: Booking['status']) {
  if (s === 'pending') return { text: 'In attesa', tone: 'amber' as const }
  if (s === 'confirmed') return { text: 'Confermata', tone: 'green' as const }
  if (s === 'done') return { text: 'Confermata', tone: 'green' as const }
  return { text: 'Annullata', tone: 'zinc' as const }
}

export function payLabel(p: Booking['payment_status']) {
  if (p === 'paid') return { text: 'Pagato', tone: 'green' as const }
  return { text: 'Da pagare', tone: 'orange' as const }
}