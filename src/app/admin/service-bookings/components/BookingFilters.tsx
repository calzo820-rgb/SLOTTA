type Props = {
  searchTerm: string
  dateFilter: string
  onlyPending: boolean
  onlyUnpaid: boolean
  mobileFiltersOpen: boolean

  setSearchTerm: (value: string) => void
  setDateFilter: (value: string) => void
  setOnlyPending: (value: boolean | ((prev: boolean) => boolean)) => void
  setOnlyUnpaid: (value: boolean | ((prev: boolean) => boolean)) => void
  setMobileFiltersOpen: (value: boolean | ((prev: boolean) => boolean)) => void

  onToday: () => void
  onTomorrow: () => void
  onReset: () => void
}

export function BookingFilters({
  searchTerm,
  dateFilter,
  onlyPending,
  onlyUnpaid,
  mobileFiltersOpen,
  setSearchTerm,
  setDateFilter,
  setOnlyPending,
  setOnlyUnpaid,
  setMobileFiltersOpen,
  onToday,
  onTomorrow,
  onReset,
}: Props) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-2">
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Cerca cliente, email o telefono..."
          className="h-11 flex-1 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
        />

        <button
          type="button"
          onClick={() => setMobileFiltersOpen(v => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-[#F8FAFC] text-lg font-black text-[#0F1D2D] md:hidden"
          aria-label="Filtri"
        >
          ☰
        </button>
      </div>

      <div
        className={`${
          mobileFiltersOpen ? 'grid' : 'hidden'
        } mt-3 gap-3 md:grid md:grid-cols-[220px_1fr] md:items-end`}
      >
        <div className="grid gap-1">
          <span className="text-xs font-bold text-slate-500">Filtra per data</span>
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <button
            type="button"
            onClick={() => setOnlyPending(v => !v)}
            className={[
              'h-11 rounded-2xl border px-4 text-sm font-bold transition',
              onlyPending
                ? 'border-[#0F1D2D] bg-[#0F1D2D] text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-[#1FA7A6] hover:text-[#1FA7A6]',
            ].join(' ')}
          >
            Solo in attesa
          </button>

          <button
            type="button"
            onClick={() => setOnlyUnpaid(v => !v)}
            className={[
              'h-11 rounded-2xl border px-4 text-sm font-bold transition',
              onlyUnpaid
                ? 'border-[#0F1D2D] bg-[#0F1D2D] text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-[#1FA7A6] hover:text-[#1FA7A6]',
            ].join(' ')}
          >
            Solo non pagati
          </button>

          <div className="hidden h-6 w-px bg-slate-200 md:block" />

          <button
            type="button"
            onClick={onToday}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
          >
            Oggi
          </button>

          <button
            type="button"
            onClick={onTomorrow}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
          >
            Domani
          </button>

          <button
            type="button"
            onClick={onReset}
            className="h-11 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  )
}