'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function SetupReturnBanner({ visible }: { visible: boolean }) {
  const pathname = usePathname()
  if (!visible || pathname === '/admin/setup') return null

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
      <div className="flex flex-col gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950 sm:flex-row sm:items-center sm:justify-between">
        <p>Configurazione iniziale in corso. Le modifiche salvate vengono rilevate automaticamente.</p>
        <Link href="/admin/setup" className="inline-flex min-h-10 items-center font-black underline underline-offset-2">
          Torna alla guida
        </Link>
      </div>
    </div>
  )
}
