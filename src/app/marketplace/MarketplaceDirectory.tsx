import type { MarketplaceSearchResult } from '@/lib/marketplaceSearch'
import MarketplaceResults from './MarketplaceResults'

type Props = {
  action: string
  q: string
  city: string
  category: string
  result: MarketplaceSearchResult
  internal?: boolean
  allowGeocoding?: boolean
  demoMode?: boolean
}

const categories = [
  ['hairdresser', 'Parrucchieri'],
  ['barber', 'Barber shop'],
  ['beauty', 'Centri estetici'],
] as const

export default function MarketplaceDirectory({
  action,
  q,
  city,
  category,
  result,
  internal = false,
  allowGeocoding = false,
  demoMode = false,
}: Props) {
  return (
    <main className="min-h-screen bg-[#F7F6F2] px-4 py-8 text-[#18212B] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        {internal ? (
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#6C7885]">
            Slotta · anteprima interna
          </p>
        ) : null}
        {demoMode ? (
          <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <strong>Anteprima di test:</strong> le attività e le posizioni sono fittizie.
            Le prenotazioni non sono attive.
          </div>
        ) : null}
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Trova un’attività
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Cerca un salone per nome o scegli un Comune. Prenoti direttamente con
          l’attività attraverso Slotta.
        </p>

        <form
          action={action}
          method="get"
          className="mt-6 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-end"
        >
          <label className="grid gap-1.5 text-sm font-semibold">
            Nome attività
            <input
              name="q"
              defaultValue={q}
              maxLength={80}
              placeholder="Es. Studio Elena"
              className="h-11 rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/15"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Comune
            <input
              name="city"
              defaultValue={city}
              maxLength={80}
              placeholder="Es. Torino"
              className="h-11 rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/15"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Categoria
            <select
              name="category"
              defaultValue={category}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/15"
            >
              <option value="">Tutte le categorie</option>
              {categories.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-11 rounded-xl bg-[#FFC145] px-6 text-sm font-bold text-[#18212B] transition hover:brightness-95"
          >
            Cerca
          </button>
        </form>

        <section aria-live="polite" className="mt-7">
          {result.error ? (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              La ricerca non è disponibile in questo momento. Riprova tra poco.
            </div>
          ) : result.needsLocationOrName ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Inserisci il nome di un’attività o il Comune per iniziare la ricerca.
            </p>
          ) : result.items.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Non abbiamo trovato attività con questi criteri.
            </p>
          ) : (
            <MarketplaceResults
              items={result.items}
              hasMore={result.hasMore}
              allowGeocoding={internal && allowGeocoding}
            />
          )}
        </section>
      </div>
    </main>
  )
}
