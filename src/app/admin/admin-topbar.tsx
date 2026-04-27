'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import UserMenu from '@/components/UserMenu'

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

export default function AdminTopBar({ tenantId }: { tenantId: string }) {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)

  const tabs = [
    { label: 'Servizi', href: '/admin/services' },
    { label: 'Prenotazioni', href: '/admin/service-bookings' },
    { label: 'Calendario', href: '/admin/service-calendar' },
    { label: 'Orari & capacità', href: '/admin/hours' },
    { label: 'Impostazioni', href: '/admin/branding' },
    { label: 'Staff & accessi', href: '/admin/staff' },
  ]

  async function loadPendingCount() {
    if (!tenantId) return

    const { count, error } = await supabase
      .from('service_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')

    if (error) {
      console.error('Errore conteggio prenotazioni pending:', error)
      return
    }

    setPendingCount(count || 0)
  }

  useEffect(() => {
    if (!tenantId) return
    loadPendingCount()
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) return

    const channel = supabase
      .channel(`topbar-service-bookings-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_bookings',
          filter: `tenant_id=eq.${tenantId}`,
        },
        async () => {
          await loadPendingCount()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId])

  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xl font-bold">Area admin</div>

        <div className="flex items-center gap-3">
          <nav className="flex flex-wrap items-center gap-2">
            {tabs.map(tab => {
              const active = isActive(pathname, tab.href)
              const isBookingsTab = tab.href === '/admin/service-bookings'

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    'relative px-4 py-2 rounded-xl border text-sm transition',
                    active
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50',
                  ].join(' ')}
                >
                  <span className="relative inline-flex items-center">
                    {tab.label}

                    {isBookingsTab && pendingCount > 0 && (
                      <span className="absolute -top-3 -right-4 min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center leading-none shadow-sm">
                        {pendingCount}
                      </span>
                    )}
                  </span>
                </Link>
              )
            })}
          </nav>

          <UserMenu />
        </div>
      </div>
    </header>
  )
}