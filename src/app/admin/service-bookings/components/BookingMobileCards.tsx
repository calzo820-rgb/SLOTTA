import type { Booking, Service } from '../types'
import { fmtDate, fmtTime, euro } from '../utils/booking-format'
import { Badge, statusLabel, payLabel } from './BookingBadges'

type Props = {
  loading: boolean
  bookings: Booking[]
  serviceById: Record<string, Service>
  staffNameById: Record<string, string>
  selectedSet: Set<string>
  onToggleSelected: (id: string) => void
  onOpenBooking: (id: string) => void
}

export function BookingMobileCards({
  loading,
  bookings,
  serviceById,
  staffNameById,
  selectedSet,
  onToggleSelected,
  onOpenBooking,
}: Props) {
  return (
    <div className="grid gap-3 p-3 sm:hidden">
      {loading && bookings.length === 0 && (
        <div className="px-4 py-10 text-center text-slate-500">
          Caricamento…
        </div>
      )}

      {!loading && bookings.length === 0 && (
        <div className="px-4 py-10 text-center text-slate-500">
          Nessuna prenotazione trovata.
        </div>
      )}

      {!loading &&
        bookings.map(b => {
          const svc = serviceById[b.service_id]
          const isPending = b.status === 'pending'
          const sLabel = statusLabel(b.status)
          const pLabel = payLabel(b.payment_status)
          const staffName = b.staff_id
            ? staffNameById[b.staff_id] || 'Operatore'
            : 'Qualsiasi'

          return (
            <div
              key={b.id}
              className={[
                'relative w-full rounded-3xl border p-4 text-left shadow-sm transition',
                isPending
                  ? 'border-amber-200 bg-amber-50'
                  : selectedSet.has(b.id)
                  ? 'border-[#1FA7A6] bg-[#F3FBFB]'
                  : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <label
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm"
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(b.id)}
                    onChange={() => onToggleSelected(b.id)}
                    className="h-4 w-4"
                    aria-label={`Seleziona prenotazione di ${
                      b.customer_name || 'cliente'
                    }`}
                  />
                  Seleziona
                </label>

                {selectedSet.has(b.id) ? (
                  <span className="rounded-full bg-[#E6FFFA] px-3 py-1 text-[11px] font-black text-[#0F766E]">
                    Selezionata
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onOpenBooking(b.id)}
                className="w-full text-left active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-[#0F1D2D]">
                      {svc?.name || '—'}
                    </div>

                    <div className="mt-1 text-xs font-medium text-slate-500">
                      {fmtDate(b.booking_date)} • {fmtTime(b.booking_time)}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Operatore:{' '}
                      <span className="font-bold text-slate-700">
                        {staffName}
                      </span>
                    </div>

                    <div className="mt-3 text-sm">
                      <span className="font-black text-[#0F1D2D]">
                        {b.customer_name || '—'}
                      </span>
                    </div>

                    <div className="mt-1 line-clamp-1 text-xs text-slate-500">
                      {b.note || 'Nessuna nota'}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="font-black text-[#0F1D2D]">
                      {svc ? `€ ${euro(svc.price_cents)}` : '—'}
                    </div>

                    <div className="mt-2 flex flex-col items-end gap-1">
                      <Badge tone={pLabel.tone}>{pLabel.text}</Badge>
                      <Badge tone={sLabel.tone}>
                        {isPending ? 'Nuovo' : sLabel.text}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )
        })}
    </div>
  )
}