import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { hasMarketplaceInternalAccess } from '@/lib/marketplaceAccess'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Marketplace — test interno',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function InternalMarketplacePage() {
  if (!(await hasMarketplaceInternalAccess())) notFound()

  return (
    <main className="min-h-screen bg-[#F7F6F2] px-4 py-10 text-[#18212B] sm:px-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6C7885]">
          Slotta · area interna
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Marketplace V1</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Accesso di test protetto. La ricerca pubblica è disattivata e in questa
          fase non vengono mostrati né modificati dati delle attività.
        </p>
        <div className="mt-6 rounded-2xl bg-[#F7F6F2] p-4 text-sm">
          Fase 1: base tecnica e accesso interno.
        </div>
      </section>
    </main>
  )
}
