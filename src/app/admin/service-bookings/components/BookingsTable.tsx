import type { Booking, Service } from '../types'
import { fmtDate, fmtTime, euro } from '../utils/booking-format'
import { Badge, statusLabel, payLabel } from './BookingBadges'

type Props = {
  loading: boolean
  bookings: Booking[]
  serviceById: Record<string, Service>
  staffNameById: Record<string, string>
  selectedSet: Set<string>
  allVisibleSelected: boolean

  onToggleAllVisible: () => void
  onToggleSelected: (id: string) => void
  onOpenBooking: (id: string) => void
  onUpdateStatus: (id: string, status: Booking['status']) => void | Promise<void>
  onTogglePaid: (
    id: string,
    current: Booking['payment_status'],
  ) => void | Promise<void>
}

export function BookingsTable({
  loading,
  bookings,
  serviceById,
  staffNameById,
  selectedSet,
  allVisibleSelected,
  onToggleAllVisible,
  onToggleSelected,
  onOpenBooking,
  onUpdateStatus,
  onTogglePaid,
}: Props) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full text-sm">
        <thead className="bg-white text-left">
          <tr className="text-xs font-black uppercase tracking-wide text-slate-400">
            <th className="w-12 border-b border-slate-100 px-4 py-3">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={onToggleAllVisible}
                className="h-4 w-4"
                aria-label="Seleziona tutte le prenotazioni visibili"
              />
            </th>

            <th className="border-b border-slate-100 px-4 py-3">Quando</th>
            <th className="border-b border-slate-100 px-4 py-3">Servizio</th>
            <th className="border-b border-slate-100 px-4 py-3">Cliente</th>
            <th className="border-b border-slate-100 px-4 py-3">Operatore</th>
            <th className="border-b border-slate-100 px-4 py-3">Totale</th>
            <th className="border-b border-slate-100 px-4 py-3">Pagamento</th>
            <th className="border-b border-slate-100 px-4 py-3">Stato</th>
            <th className="border-b border-slate-100 px-4 py-3">Note</th>
            <th className="border-b border-slate-100 px-4 py-3 text-right">
              Azioni
            </th>
          </tr>
        </thead>

        <tbody>
          {loading && bookings.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                Caricamento…
              </td>
            </tr>
          )}

          {!loading && bookings.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                Nessuna prenotazione trovata.
              </td>
            </tr>
          )}

          {bookings.map(b => {
            const svc = serviceById[b.service_id]
            const isPending = b.status === 'pending'
            const isNewForManager = b.manager_seen_at == null && b.status !== 'cancelled'
            const sLabel = statusLabel(b.status)
            const pLabel = payLabel(b.payment_status)

            const contact = (b.customer_phone || b.customer_email || '').trim()
            const isEmail = contact.includes('@')
            const staffName = b.staff_id
              ? staffNameById[b.staff_id] || 'Operatore'
              : 'Qualsiasi'

            return (
              <tr
                key={b.id}
                onClick={() => onOpenBooking(b.id)}
                className={[
  'cursor-pointer border-b border-slate-100 transition',
  isPending
    ? 'bg-amber-50/70 hover:bg-amber-100/60'
    : isNewForManager
      ? 'bg-teal-50/80 ring-1 ring-inset ring-teal-200 hover:bg-teal-100/70'
      : 'hover:bg-[#F8FAFC]',
].join(' ')}
              >
                <td
                  className="border-b border-slate-100 px-4 py-4 align-top"
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
                </td>

                <td className="relative whitespace-nowrap px-4 py-4 align-top">
                  {(isPending || isNewForManager) && (
  <span
    className={[
      'absolute bottom-0 left-0 top-0 w-1',
      isPending ? 'bg-[#FFC145]' : 'bg-[#1FA7A6]',
    ].join(' ')}
  />
)}
                  <div className="font-black text-[#0F1D2D]">
                    {fmtDate(b.booking_date)}
                  </div>
                  <div className="text-xs font-bold text-slate-500">
                    {fmtTime(b.booking_time)}
                  </div>

                  {(isPending || isNewForManager) && (
  <div className="mt-2">
    {isPending ? (
      <Badge tone="amber">Da gestire</Badge>
    ) : (
      <Badge tone="green">Nuova</Badge>
    )}
  </div>
)}
                </td>

                <td className="px-4 py-4 align-top">
                  <div className="font-black text-[#0F1D2D]">
                    {svc?.name || '—'}
                  </div>
                  {svc && (
                    <div className="text-xs text-slate-500">
                      {svc.duration_minutes} min
                    </div>
                  )}
                </td>

                <td className="px-4 py-4 align-top">
                  <div className="font-black text-[#0F1D2D]">
                    {b.customer_name || '—'}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {contact ? (
                      isEmail ? (
                        <span className="break-all">✉️ {contact}</span>
                      ) : (
                        <span className="break-all">📞 {contact}</span>
                      )
                    ) : (
                      '—'
                    )}
                  </div>
                </td>

                <td className="px-4 py-4 align-top">
                  <span className="text-sm font-medium text-slate-700">
                    {staffName}
                  </span>
                </td>

                <td className="whitespace-nowrap px-4 py-4 align-top font-black text-[#0F1D2D]">
                  {svc ? `€ ${euro(svc.price_cents)}` : '—'}
                </td>

                <td className="px-4 py-4 align-top">
                  <Badge tone={pLabel.tone}>{pLabel.text}</Badge>
                </td>

                <td className="px-4 py-4 align-top">
                  <Badge tone={sLabel.tone}>{sLabel.text}</Badge>
                </td>

                <td className="max-w-[220px] px-4 py-4 align-top">
                  <span className="line-clamp-2 text-xs text-slate-600">
                    {b.note || '—'}
                  </span>
                </td>

                <td className="px-4 py-4 align-top">
                  <div className="flex flex-wrap justify-end gap-2">
                    {b.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            onUpdateStatus(b.id, 'confirmed')
                          }}
                          className="inline-flex h-11 w-[110px] items-center justify-center rounded-2xl border border-[#1FA7A6]/30 bg-[#E6FFFA] px-3 text-sm font-bold text-[#0F766E] transition hover:bg-[#CCFBF1]"
                        >
                          Conferma
                        </button>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            onUpdateStatus(b.id, 'cancelled')
                          }}
                          className="inline-flex h-11 w-[110px] items-center justify-center rounded-2xl border border-red-200 bg-white px-3 text-sm font-bold text-red-700 transition hover:bg-red-50"
                        >
                          Rifiuta
                        </button>
                      </>
                    ) : b.status === 'confirmed' ? (
                      <>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            onTogglePaid(b.id, b.payment_status)
                          }}
                          className="inline-flex h-11 w-[130px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
                        >
                          {b.payment_status === 'paid'
                            ? 'Non pagato'
                            : 'Segna pagato'}
                        </button>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            onUpdateStatus(b.id, 'cancelled')
                          }}
                          className="inline-flex h-11 w-[110px] items-center justify-center rounded-2xl border border-red-200 bg-white px-3 text-sm font-bold text-red-700 transition hover:bg-red-50"
                        >
                          Annulla
                        </button>
                      </>
                    ) : b.status !== 'cancelled' ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          onTogglePaid(b.id, b.payment_status)
                        }}
                        className="inline-flex h-11 w-[130px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
                      >
                        {b.payment_status === 'paid'
                          ? 'Non pagato'
                          : 'Segna pagato'}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}