'use client'

import Link from 'next/link'

type SettingsCard = {
  title: string
  description: string
  href: string
  icon: string
  comingSoon?: boolean
}

const settingsCards: SettingsCard[] = [
  {
    title: 'Profilo attività',
    description: 'Nome attività, logo, contatti, indirizzo e link della pagina clienti.',
    href: '/admin/profile',
    icon: '🏪',
  },
  {
    title: 'Orari & capacità',
    description: 'Giorni di apertura, fasce orarie, slot e capacità di prenotazione.',
    href: '/admin/hours',
    icon: '🕒',
  },
  {
    title: 'Ferie / chiusure',
    description: 'Blocca giorni, ferie, assenze o chiusure temporanee.',
    href: '/admin/closures',
    icon: '📅',
  },
  {
    title: 'Staff & accessi',
    description: 'Operatori, orari personali, utenti staff e permessi.',
    href: '/admin/staff',
    icon: '👥',
  },
]

export default function SettingsClient() {
  return (
    <main className="min-h-screen bg-[#F2F4F7] px-4 py-5 text-[#0F1D2D] md:px-6">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header>
          <p className="hidden text-sm font-black uppercase tracking-wide text-[#1FA7A6] md:block">
            Area gestore
          </p>

          <h1 className="hidden text-3xl font-black tracking-tight text-[#0F1D2D] md:block">
            Impostazioni
          </h1>

          <p className="text-sm text-slate-600 md:mt-1">
            Gestisci profilo attività, orari, chiusure e accessi dello staff.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {settingsCards.map(card => {
            const content = (
              <div className="group h-full rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-[1px] hover:border-[#1FA7A6]/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F3FBFB] text-2xl">
                    {card.icon}
                  </div>

                  {card.comingSoon ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                      Presto
                    </span>
                  ) : (
                    <span className="text-lg font-black text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#1FA7A6]">
                      →
                    </span>
                  )}
                </div>

                <div className="mt-5">
                  <h2 className="text-xl font-black text-[#0F1D2D]">
                    {card.title}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {card.description}
                  </p>
                </div>
              </div>
            )

            if (card.comingSoon) {
              return (
                <div key={card.title} className="opacity-70">
                  {content}
                </div>
              )
            }

            return (
              <Link key={card.title} href={card.href}>
                {content}
              </Link>
            )
          })}
        </section>
      </div>
    </main>
  )
}