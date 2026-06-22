import { useEffect, useState } from 'react'
import type { Booking, Service } from '../types'
import { fmtDate, fmtTime, euro } from '../utils/booking-format'
import { Badge, statusLabel, payLabel } from './BookingBadges'

function cleanPhoneForWhatsapp(phone: string) {
  const digits = phone.replace(/\D/g, '')

  if (!digits) return ''

  if (digits.startsWith('39')) return digits

  return `39${digits}`
}

function buildWhatsappUrl({
  phone,
  customerName,
  businessName,
  serviceName,
  bookingDate,
  bookingTime,
}: {
  phone: string
  customerName: string
  businessName: string
  serviceName: string
  bookingDate: string
  bookingTime: string
}) {
  const cleanPhone = cleanPhoneForWhatsapp(phone)

  if (!cleanPhone) return null

  const message = [
    `Ciao ${customerName || ''}, ti ricordiamo l'appuntamento presso ${
      businessName || 'il salone'
    }.`,
    '',
    `Servizio: ${serviceName || 'Servizio'}`,
    `Data: ${bookingDate}`,
    `Ora: ${bookingTime}`,
    '',
    'A presto!',
  ].join('\n')

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}

type Props = {
  open: boolean
  booking: Booking | null
  service: Service | null
  staffName: string | null
  businessName: string
  onClose: () => void
  onUpdateStatus: (id: string, status: Booking['status']) => Promise<void>
  onTogglePaid: (id: string, current: Booking['payment_status']) => Promise<void>
  onDeleteBooking: (id: string) => Promise<void>
  onMarkSeen?: (id: string) => Promise<void>
}

export function BookingDrawer({
  open,
  booking,
  service,
  staffName,
  businessName,
  onClose,
  onUpdateStatus,
  onTogglePaid,
  onDeleteBooking,
  onMarkSeen,
}: Props) {
  const [contactCopied, setContactCopied] = useState(false)
useEffect(() => {
  if (!open || !booking?.id || !onMarkSeen) return

  onMarkSeen(booking.id).catch(error => {
    console.error('Errore mark booking seen:', error)
  })
}, [open, booking?.id, onMarkSeen])
  if (!open || !booking) return null

const whatsappUrl = booking.customer_phone
  ? buildWhatsappUrl({
      phone: booking.customer_phone,
      customerName: booking.customer_name || '',
      businessName,
      serviceName: service?.name || 'Servizio',
      bookingDate: fmtDate(booking.booking_date),
      bookingTime: fmtTime(booking.booking_time),
    })
  : null

async function copyContact() {
  const contact = booking?.customer_phone || booking?.customer_email || ''

  if (!contact) return

  try {
    await navigator.clipboard.writeText(contact)
    setContactCopied(true)

    window.setTimeout(() => {
      setContactCopied(false)
    }, 1800)
  } catch (e) {
    console.error('Errore copia contatto:', e)
  }
}
  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-[#0F1D2D]/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Chiudi"
      />

      <div
        className="
          absolute flex flex-col border bg-white shadow-2xl
          left-0 right-0 bottom-0 h-[85vh] rounded-t-[2rem] border-t
          sm:right-0 sm:left-auto sm:top-0 sm:h-full sm:w-[440px] sm:rounded-none sm:border-l
        "
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="px-4 pt-3 sm:hidden">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
        </div>

        <div className="border-b border-slate-100 px-5 pb-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">
                Dettaglio prenotazione
              </div>

              <div className="truncate text-xl font-black text-[#0F1D2D]">
                {service?.name || 'Servizio'}
              </div>

              <div className="mt-1 text-sm font-medium text-slate-600">
                {fmtDate(booking.booking_date)} • {fmtTime(booking.booking_time)}
              </div>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold transition hover:bg-slate-50"
            >
              Chiudi
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(() => {
              const s = statusLabel(booking.status)
              return <Badge tone={s.tone}>{s.text}</Badge>
            })()}

            {(() => {
              const p = payLabel(booking.payment_status)
              return <Badge tone={p.tone}>{p.text}</Badge>
            })()}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 text-sm">
            <div className="rounded-3xl border border-slate-200 bg-[#F8FAFC] p-4">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                Cliente
              </div>

              <div className="mt-1 font-black text-[#0F1D2D]">
                {booking.customer_name || '—'}
              </div>

              <div className="mt-1 break-all text-xs text-slate-600">
                {booking.customer_phone || booking.customer_email || '—'}
              </div>

              {(whatsappUrl || booking.customer_phone || booking.customer_email) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-2xl bg-[#25D366] px-3 py-2 text-xs font-black text-white transition hover:brightness-95"
                    >
                      💬 Scrivi su WhatsApp
                    </a>
                  ) : null}

                 <button
  type="button"
  className={[
    'inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-xs font-bold transition',
    contactCopied
      ? 'border-green-200 bg-green-50 text-green-700'
      : 'border-slate-200 bg-white text-[#1FA7A6] hover:bg-slate-50',
  ].join(' ')}
  onClick={copyContact}
>
  {contactCopied ? '✅ Copiato' : 'Copia contatto'}
</button>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                Operatore
              </div>
              <div className="mt-1 font-black text-[#0F1D2D]">
                {staffName || '—'}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                Durata e totale
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-bold text-slate-700">
                  {service?.duration_minutes || 60} min
                </span>
                <span className="font-black text-[#0F1D2D]">
                  € {service ? euro(service.price_cents) : '—'}
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                Note
              </div>
              <div className="mt-1 whitespace-pre-wrap text-slate-700">
                {booking.note || '—'}
              </div>
            </div>
          </div>

          <div className="mt-4 text-[11px] text-slate-500">
            Tip: tocca fuori dal pannello per chiudere.
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-5 py-4">
          <div className="grid gap-2">
            {booking.status === 'pending' ? (
              <>
                <button
                  onClick={async () => {
                    await onUpdateStatus(booking.id, 'confirmed')
                  }}
                  className="w-full rounded-2xl bg-[#1FA7A6] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0F766E]"
                >
                  Conferma prenotazione
                </button>

                <button
                  onClick={async () => {
                    await onUpdateStatus(booking.id, 'cancelled')
                  }}
                  className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-50"
                >
                  Rifiuta prenotazione
                </button>
              </>
            ) : booking.status === 'confirmed' ? (
              <>
                <button
                  onClick={async () => {
                    await onTogglePaid(booking.id, booking.payment_status)
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
                >
                  {booking.payment_status === 'paid'
                    ? 'Segna NON pagato'
                    : 'Segna pagato'}
                </button>

                <button
                  onClick={async () => {
                    await onUpdateStatus(booking.id, 'cancelled')
                  }}
                  className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-50"
                >
                  Annulla prenotazione
                </button>
              </>
            ) : (
              <>
                {booking.status !== 'cancelled' && (
                  <button
                    onClick={async () => {
                      await onTogglePaid(booking.id, booking.payment_status)
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
                  >
                    {booking.payment_status === 'paid'
                      ? 'Segna NON pagato'
                      : 'Segna pagato'}
                  </button>
                )}

                <button
                  onClick={async () => {
                    await onDeleteBooking(booking.id)
                    onClose()
                  }}
                  className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-50"
                >
                  Elimina prenotazione
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}