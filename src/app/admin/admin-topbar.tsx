'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import UserMenu from '@/components/UserMenu'

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

type AdminRole = 'owner' | 'staff'

export default function AdminTopBar({
  tenantId,
  role,
  allowedPages,
}: {
  tenantId: string
  role: AdminRole
  allowedPages: string[] | null
}) {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const allTabs = [
  { key: 'bookings', label: 'Prenotazioni', href: '/admin/service-bookings' },
  { key: 'calendar', label: 'Calendario', href: '/admin/service-calendar' },
  { key: 'services', label: 'Servizi', href: '/admin/services' },
  { key: 'hours', label: 'Orari', href: '/admin/hours' },
  { key: 'closures', label: 'Chiusure', href: '/admin/closures' },
  { key: 'staff', label: 'Staff', href: '/admin/staff' },
  { key: 'profile', label: 'Profilo', href: '/admin/profile' },
]

const tabs =
  role === 'owner'
    ? allTabs
    : allTabs.filter(tab => allowedPages?.includes(tab.key))

  const activeTab = tabs.find(tab => isActive(pathname, tab.href))

async function loadPendingCount() {
  if (!tenantId) return

  const { count, error } = await supabase
    .from('service_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('manager_seen_at', null)
    .neq('status', 'cancelled')
    .or('checkout_pending.is.null,checkout_pending.eq.false')

  if (error) {
    console.error('Errore conteggio prenotazioni non viste:', error)
    return
  }

  setPendingCount(count ?? 0)
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
  <header className="sticky top-0 z-40 border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] via-white to-[#F8FAFC] backdrop-blur-xl md:border-slate-200 md:bg-white/90 md:bg-none">
    <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
     {/* MOBILE */}
<div className="md:hidden relative flex items-center justify-between gap-3">
  {/* HAMBURGER SINISTRA */}
  <button
    type="button"
    onClick={() => setMenuOpen(!menuOpen)}
    className="relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D7EEF0] bg-white text-2xl shadow-sm transition hover:border-[#1FA7A6]/50"
    aria-label="Apri menu"
  >
    ☰

    {pendingCount > 0 && (
      <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-black flex items-center justify-center leading-none shadow-sm ring-2 ring-white">
        {pendingCount > 9 ? '9+' : pendingCount}
      </span>
    )}
  </button>

  {/* TITOLO PAGINA CENTRALE */}
<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
    <span className="h-2.5 w-2.5 rounded-full bg-[#FFC145]" />
    <span className="text-xl font-black tracking-tight text-[#0F1D2D]">
      {activeTab?.label || 'Area gestore'}
    </span>
  </div>
</div>

  {/* MENU UTENTE DESTRA */}
  <div className="relative z-10">
    <UserMenu />
  </div>
</div>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[#0F1D2D]/30 md:hidden"
            onClick={() => setMenuOpen(false)}
          />

          <div className="fixed left-4 right-4 top-[72px] z-50 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl md:hidden">
            <div className="border-b border-slate-100 bg-[#F8FAFC] px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">
                Menu gestore
              </p>
              <p className="text-sm font-bold text-slate-500">
                Gestisci la tua attività
              </p>
            </div>

            {tabs.map(tab => {
              const active = isActive(pathname, tab.href)
              const isBookingsTab = tab.href === '/admin/service-bookings'

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    'flex items-center justify-between border-b border-slate-100 px-4 py-4 text-sm font-black last:border-b-0',
                    active
                      ? 'bg-[#0F1D2D] text-white'
                      : 'bg-white text-[#0F1D2D] hover:bg-[#F8FAFC]',
                  ].join(' ')}
                >
                  <span>{tab.label}</span>

                  {isBookingsTab && pendingCount > 0 && (
                    <span
                      className={[
                        'flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-black',
                        active ? 'bg-[#FFC145] text-[#0F1D2D]' : 'bg-red-600 text-white',
                      ].join(' ')}
                    >
                      {pendingCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </>
      )}

      {/* DESKTOP */}
      <div className="hidden items-center justify-between gap-4 md:flex">
        <div className="flex items-center gap-3">
          <img
  src="/icon-192.png"
  alt="Slotta"
  className="h-11 w-11 rounded-2xl object-contain bg-white shadow-sm border border-slate-200"
/>

          <div>
            <div className="flex items-center gap-2">
              <div className="text-xl font-black tracking-tight text-[#0F1D2D]">
                Slotta
              </div>

              <span className="rounded-full bg-[#F2F4F7] px-3 py-1 text-xs font-black text-[#1FA7A6]">
                Area gestore
              </span>
            </div>

            {activeTab && (
              <div className="mt-0.5 text-xs font-bold text-slate-500">
                {activeTab.label}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <nav className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {tabs.map(tab => {
              const active = isActive(pathname, tab.href)
              const isBookingsTab = tab.href === '/admin/service-bookings'

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    'relative rounded-2xl border px-3 py-2 text-sm font-bold transition-all duration-200',
                    active
                      ? 'border-[#0F1D2D] bg-[#0F1D2D] text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-[1px] hover:border-[#1FA7A6] hover:text-[#1FA7A6] hover:shadow-sm',
                  ].join(' ')}
                >
                  <span className="relative inline-flex items-center">
                    {tab.label}

                    {isBookingsTab && pendingCount > 0 && (
                      <span
                        className={[
                          'absolute -right-4 -top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-black leading-none shadow-sm',
                          active ? 'bg-[#FFC145] text-[#0F1D2D]' : 'bg-red-600 text-white',
                        ].join(' ')}
                      >
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
    </div>
  </header>
)
}