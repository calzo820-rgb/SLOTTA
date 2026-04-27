'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/admin/services', label: 'Servizi' },
  { href: '/admin/service-bookings', label: 'Prenotazioni' },
  { href: '/admin/service-calendar', label: 'Calendario' }, // 👈 nuovo tab
  { href: '/admin/hours', label: 'Orari & capacità' },
]

export function AdminServiceNav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-2">
      {ITEMS.map(item => {
        const active =
          pathname === item.href ||
          pathname.startsWith(item.href + '/') // es. sottopagine

        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              'px-3 py-2 text-sm rounded border ' +
              (active
                ? 'bg-red-600 border-red-600 text-white'
                : 'bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100')
            }
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
