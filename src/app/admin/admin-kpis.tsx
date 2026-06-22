'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type BookingRow = {
  id: string
  booking_date: string
  service_id: string
  payment_status: 'paid' | 'unpaid' | null
  status: 'pending' | 'confirmed' | 'done' | 'cancelled'
}

type ServiceRow = {
  id: string
  price_cents: number
}

function dateToYMD(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMonday(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function euro(cents: number) {
  return `€ ${(cents / 100).toFixed(2)}`
}

export default function AdminKpis({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allBookings, setAllBookings] = useState<BookingRow[]>([])
  const [services, setServices] = useState<ServiceRow[]>([])

  useEffect(() => {
    if (!tenantId) return

    let cancelled = false

    async function loadKpis() {
      setLoading(true)
      setError(null)

      try {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthStartStr = dateToYMD(monthStart)

        const { data: serviceRows, error: serviceErr } = await supabase
          .from('services')
          .select('id, price_cents')
          .eq('tenant_id', tenantId)

        if (serviceErr) throw serviceErr

        const { data: bookingRows, error: bookingErr } = await supabase
          .from('service_bookings')
          .select('id, booking_date, service_id, payment_status, status')
          .eq('tenant_id', tenantId)
          .gte('booking_date', monthStartStr)

        if (bookingErr) throw bookingErr

        if (!cancelled) {
          setServices((serviceRows || []) as ServiceRow[])
          setAllBookings((bookingRows || []) as BookingRow[])
        }
      } 
      catch (e: unknown) {
  console.error(e)

  if (!cancelled) {
    const message = e instanceof Error ? e.message : 'Errore nel caricamento KPI.'
    setError(message)
  }
} finally {
  if (!cancelled) setLoading(false)
}
    }

    loadKpis()

    return () => {
      cancelled = true
    }
  }, [tenantId])

  const stats = useMemo(() => {
    const now = new Date()
    const todayStr = dateToYMD(now)
    const mondayStr = dateToYMD(getMonday(now))
    const monthStartStr = dateToYMD(new Date(now.getFullYear(), now.getMonth(), 1))

    const servicePriceById: Record<string, number> = {}
    services.forEach(s => {
      servicePriceById[s.id] = s.price_cents || 0
    })

    let todayCents = 0
    let weekCents = 0
    let monthCents = 0
    let paidTodayCount = 0

    let todayBookings = 0
    let pendingCount = 0
    let confirmedCount = 0

    for (const b of allBookings) {
      const price = servicePriceById[b.service_id] || 0

      // KPI operativi di oggi
      if (b.booking_date === todayStr) {
        todayBookings++

        if (b.status === 'pending') pendingCount++
        if (b.status === 'confirmed') confirmedCount++
      }

      // KPI economici solo per prenotazioni pagate
      if (b.payment_status === 'paid') {
        if (b.booking_date === todayStr) {
          todayCents += price
          paidTodayCount++
        }

        if (b.booking_date >= mondayStr) {
          weekCents += price
        }

        if (b.booking_date >= monthStartStr) {
          monthCents += price
        }
      }
    }

    return {
      todayCents,
      weekCents,
      monthCents,
      paidTodayCount,
      todayBookings,
      pendingCount,
      confirmedCount,
    }
  }, [allBookings, services])

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
      {error ? (
        <div className="text-sm text-red-700 border rounded-xl p-3 bg-red-50">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
  <div className="rounded-2xl border bg-white shadow-sm p-3">
    <div className="text-xs uppercase tracking-wide text-zinc-500">
      Incasso online oggi
    </div>
    <div className="mt-1 text-xl font-bold">
      {loading ? '…' : euro(stats.todayCents)}
    </div>
    <div className="mt-1 text-[11px] text-zinc-500 leading-snug">
      Solo prenotazioni pagate online
    </div>
  </div>

  <div className="rounded-2xl border bg-white shadow-sm p-3">
    <div className="text-xs uppercase tracking-wide text-zinc-500">
      Prenotazioni oggi
    </div>
    <div className="mt-1 text-xl font-bold">
      {loading ? '…' : stats.todayBookings}
    </div>
    <div className="mt-1 text-[11px] text-zinc-500 leading-snug">
      Tutte le prenotazioni di oggi
    </div>
  </div>

  <div className="rounded-2xl border bg-white shadow-sm p-3">
    <div className="text-xs uppercase tracking-wide text-zinc-500">
      In attesa
    </div>
    <div className="mt-1 text-xl font-bold text-amber-600">
      {loading ? '…' : stats.pendingCount}
    </div>
    <div className="mt-1 text-[11px] text-zinc-500 leading-snug">
      Prenotazioni da confermare oggi
    </div>
  </div>

  <div className="rounded-2xl border bg-white shadow-sm p-3">
    <div className="text-xs uppercase tracking-wide text-zinc-500">
      Confermate
    </div>
    <div className="mt-1 text-xl font-bold text-green-600">
      {loading ? '…' : stats.confirmedCount}
    </div>
    <div className="mt-1 text-[11px] text-zinc-500 leading-snug">
      Prenotazioni confermate oggi
    </div>
  </div>
</div>
    </section>
  )
}