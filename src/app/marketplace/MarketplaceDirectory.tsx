import Link from 'next/link'
import type { MarketplaceSearchResult } from '@/lib/marketplaceSearch'

type Props = {
  action: string
  q: string
  city: string
  category: string
  result: MarketplaceSearchResult
  internal?: boolean
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
}: Props) {
  return (
    <main className="min-h-screen bg-[#F7F6F2] px-4 py-8 text-[#18212B] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        {internal ? (
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#6C7885]">
            Slotta · anteprima interna
          </p>
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
            <>
              <p className="mb-3 text-sm text-slate-600">
                {result.hasMore ? 'Più di ' : ''}{result.items.length} attività trovate
              </p>
              <ul className="grid gap-3 md:grid-cols-2">
                {result.items.map(item => (
                  <li key={item.id}>
                    <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                      {item.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.logoUrl}
                          alt=""
                          loading="lazy"
                          className="mb-3 h-16 w-16 shrink-0 rounded-2xl border border-slate-100 object-cover sm:mb-0"
                        />
                      ) : (
                        <div aria-hidden="true" className="mb-3 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#F7F6F2] text-xl font-bold text-[#6C7885] sm:mb-0">
                          {item.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-lg font-semibold">{item.name}</h2>
                        <p className="mt-0.5 text-sm font-medium text-[#52736F]">
                          {item.categoryLabel}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {[item.address, item.postalCode, item.city, item.provinceCode]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {item.description ? (
                          <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                      <Link
                        href={item.bookingUrl}
                        className="mt-4 inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#18212B] px-5 text-sm font-bold text-white transition hover:bg-[#304253] sm:mt-0"
                      >
                        Prenota
                      </Link>
                    </article>
                  </li>
                ))}
              </ul>
              {result.hasMore ? (
                <p className="mt-4 text-center text-sm text-slate-500">
                  Affina la ricerca con il nome o il Comune per restringere i risultati.
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
