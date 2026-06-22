import type { Service, Staff } from '../types'
import { euro } from '../utils/booking-format'

type Props = {
  open: boolean
  services: Service[]
  staffRows: Staff[]
  availableSlots: string[]

  newBookingSaving: boolean
  newBookingServiceId: string
  newBookingStaffId: string
  newBookingDate: string
  newBookingTime: string
  newCustomerName: string
  newCustomerPhone: string
  newCustomerEmail: string
  newBookingNote: string

  onClose: () => void
  onCreate: () => void

  setNewBookingServiceId: (value: string) => void
  setNewBookingStaffId: (value: string) => void
  setNewBookingDate: (value: string) => void
  setNewBookingTime: (value: string) => void
  setNewCustomerName: (value: string) => void
  setNewCustomerPhone: (value: string) => void
  setNewCustomerEmail: (value: string) => void
  setNewBookingNote: (value: string) => void
}

export function NewBookingModal({
  open,
  services,
  staffRows,
  availableSlots,
  newBookingSaving,
  newBookingServiceId,
  newBookingStaffId,
  newBookingDate,
  newBookingTime,
  newCustomerName,
  newCustomerPhone,
  newCustomerEmail,
  newBookingNote,
  onClose,
  onCreate,
  setNewBookingServiceId,
  setNewBookingStaffId,
  setNewBookingDate,
  setNewBookingTime,
  setNewCustomerName,
  setNewCustomerPhone,
  setNewCustomerEmail,
  setNewBookingNote,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1D2D]/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-[#F8FAFC] p-5">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
              Prenotazione manuale
            </p>
            <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
              Nuovo appuntamento
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Inserisci una prenotazione ricevuta al telefono o in negozio.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold transition hover:bg-slate-50"
          >
            Chiudi
          </button>
        </div>

        <div className="max-h-[calc(90vh-96px)] overflow-y-auto p-5">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-bold text-[#0F1D2D]">Servizio</span>
                <select
                  value={newBookingServiceId}
                  onChange={e => setNewBookingServiceId(e.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                >
                  <option value="">Seleziona servizio</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.duration_minutes} min · € {euro(s.price_cents)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-bold text-[#0F1D2D]">Operatore</span>
                <select
                  value={newBookingStaffId}
                  onChange={e => setNewBookingStaffId(e.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                >
                  <option value="">Qualsiasi / non assegnato</option>
                  {staffRows.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-bold text-[#0F1D2D]">Data</span>
                <input
                  type="date"
                  value={newBookingDate}
                  onChange={e => setNewBookingDate(e.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-bold text-[#0F1D2D]">
                  Ora disponibile
                </span>

                <select
                  value={newBookingTime}
                  onChange={e => setNewBookingTime(e.target.value)}
                  disabled={!newBookingServiceId || availableSlots.length === 0}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {!newBookingServiceId ? (
                    <option value="">Seleziona prima un servizio</option>
                  ) : availableSlots.length === 0 ? (
                    <option value="">Nessun orario disponibile</option>
                  ) : (
                    availableSlots.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))
                  )}
                </select>

                <span className="text-xs text-slate-500">
                  Gli orari occupati o fuori apertura non vengono mostrati.
                </span>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-bold text-[#0F1D2D]">
                  Nome cliente
                </span>
                <input
                  value={newCustomerName}
                  onChange={e => setNewCustomerName(e.target.value)}
                  placeholder="Es. Maria Rossi"
                  className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-bold text-[#0F1D2D]">Telefono</span>
                <input
                  value={newCustomerPhone}
                  onChange={e => setNewCustomerPhone(e.target.value)}
                  placeholder="Es. 333 123 4567"
                  className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                />
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-sm font-bold text-[#0F1D2D]">
                Email opzionale
              </span>
              <input
                type="email"
                value={newCustomerEmail}
                onChange={e => setNewCustomerEmail(e.target.value)}
                placeholder="cliente@email.it"
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-bold text-[#0F1D2D]">Note</span>
              <textarea
                value={newBookingNote}
                onChange={e => setNewBookingNote(e.target.value)}
                placeholder="Es. Cliente chiamato al telefono, preferisce taglio corto..."
                rows={3}
                className="min-h-[90px] rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
              />
            </label>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <span className="font-black">Nota:</span> questa prenotazione verrà
              creata come confermata e non pagata. Potrai modificarne lo stato
              dall’elenco.
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#0F1D2D] transition hover:bg-slate-50"
                disabled={newBookingSaving}
              >
                Annulla
              </button>

              <button
                type="button"
                onClick={onCreate}
                disabled={newBookingSaving}
                className="rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {newBookingSaving ? 'Creazione…' : 'Salva appuntamento'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}