'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'
import type { MarketplaceResult } from '@/lib/marketplaceSearch'
import GeocodeButton from './GeocodeButton'

const MarketplaceMap = dynamic(() => import('./MarketplaceMap'), {
  ssr: false,
  loading: () => <div className="h-[min(68vh,620px)] min-h-[360px] animate-pulse rounded-3xl bg-slate-100" />,
})

export default function MarketplaceResults({
  items,
  hasMore,
  allowGeocoding = false,
}: {
  items: MarketplaceResult[]
  hasMore: boolean
  allowGeocoding?: boolean
}) {
  const [view, setView] = useState<'list' | 'map'>('list')

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {hasMore ? 'Più di ' : ''}{items.length} attività trovate
        </p>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" aria-label="Visualizzazione risultati">
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === 'list' ? 'bg-[#18212B] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Lista
          </button>
          <button
            type="button"
            aria-pressed={view === 'map'}
            onClick={() => setView('map')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === 'map' ? 'bg-[#18212B] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Mappa
          </button>
        </div>
      </div>

      {view === 'map' ? (
        <MarketplaceMap items={items} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map(item => (
            <li key={item.id}>
              <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                {item.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.logoUrl} alt="" loading="lazy" className="mb-3 h-16 w-16 shrink-0 rounded-2xl border border-slate-100 object-cover sm:mb-0" />
                ) : (
                  <div aria-hidden="true" className="mb-3 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#F7F6F2] text-xl font-bold text-[#6C7885] sm:mb-0">
                    {item.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold">{item.name}</h2>
                  <p className="mt-0.5 text-sm font-medium text-[#52736F]">{item.categoryLabel}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {[item.address, item.postalCode, item.city, item.provinceCode].filter(Boolean).join(' · ')}
                  </p>
                  {item.description ? <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{item.description}</p> : null}
                  {allowGeocoding && item.latitude == null && item.longitude == null
                    ? <GeocodeButton tenantId={item.id} />
                    : null}
                </div>
                {item.demoOnly ? (
                  <span className="mt-4 inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 px-4 text-xs font-semibold text-slate-500 sm:mt-0">
                    Prenotazione non attiva
                  </span>
                ) : (
                  <Link href={item.bookingUrl} className="mt-4 inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#18212B] px-5 text-sm font-bold text-white transition hover:bg-[#304253] sm:mt-0">
                    Prenota
                  </Link>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
      {hasMore ? (
        <p className="mt-4 text-center text-sm text-slate-500">
          Affina la ricerca con il nome o il Comune per restringere i risultati.
        </p>
      ) : null}
    </>
  )
}
