import { fmtDate } from '../utils/booking-format'

type Props = {
  dateFilter: string
  resultsCount: number
  selectedCount: number
  onDeleteSelected: () => void
}

export function BookingsListHeader({
  dateFilter,
  resultsCount,
  selectedCount,
  onDeleteSelected,
}: Props) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 bg-[#F8FAFC] px-5 py-4">
      <div>
        <div className="text-sm font-black text-[#0F1D2D]">
          Elenco prenotazioni
        </div>
        <div className="mt-0.5 text-xs font-medium text-slate-500">
          {dateFilter ? `Filtro: ${fmtDate(dateFilter)}` : 'Tutte le date'}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {selectedCount > 0 ? (
          <button
            type="button"
            onClick={onDeleteSelected}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-3 text-xs font-black text-red-700 shadow-sm transition hover:bg-red-50"
            title="Elimina prenotazioni selezionate"
          >
            <span>🗑️</span>
            <span>Elimina {selectedCount}</span>
          </button>
        ) : null}

        <div className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#1FA7A6] shadow-sm">
          {resultsCount} risultati
        </div>
      </div>
    </div>
  )
}