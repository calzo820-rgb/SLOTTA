import Link from 'next/link'
import { loadManagedBooking } from '@/lib/serverBookingManagement'
import { ManageBookingActions } from './ManageBookingActions'

export const dynamic = 'force-dynamic'
export const metadata = {
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string }>
}

function fmtDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function stateMessage(
  state: 'available' | 'cancelled' | 'paid' | 'completed' | 'too_late',
  noticeHours: number,
) {
  if (state === 'cancelled') return 'Questa prenotazione è già stata annullata.'
  if (state === 'paid') {
    return 'Questa prenotazione è già pagata. Contatta l’attività per concordare annullamento e rimborso.'
  }
  if (state === 'completed') return 'Questo appuntamento è già trascorso.'
  if (state === 'too_late') {
    return `Il termine di ${noticeHours} ore per annullare online è scaduto. Contatta direttamente l’attività.`
  }
  return `Puoi annullare online fino a ${noticeHours} ore prima dell’appuntamento.`
}

export default async function ManageBookingPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { token = '' } = await searchParams
  const managed = await loadManagedBooking(slug, token)

  if (!managed) {
    return (
      <main className="min-h-screen bg-[#F2F4F7] px-4 py-8 text-[#0F1D2D]">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-2xl font-black text-amber-900">!</div>
          <h1 className="text-2xl font-black">Link non disponibile</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Il link è errato o scaduto. Contatta direttamente l’attività.
          </p>
          <Link href={`/t/${slug}`} className="mt-6 block rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black">
            Torna alle prenotazioni
          </Link>
        </section>
      </main>
    )
  }

  const whatsappHref = managed.tenant.whatsapp_phone
    ? `https://wa.me/${managed.tenant.whatsapp_phone.replace(/\D/g, '')}`
    : null

  return (
    <main className="min-h-screen bg-[#F2F4F7] px-4 py-8 text-[#0F1D2D]">
      <div className="mx-auto grid max-w-xl gap-5">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-[#0F1D2D] px-6 py-8 text-center text-white">
            <p className="text-xs font-black uppercase tracking-widest text-[#57D3CF]">Gestisci appuntamento</p>
            <h1 className="mt-2 text-2xl font-black">{managed.tenant.name}</h1>
          </div>

          <div className="grid gap-4 p-6">
            <div className="rounded-3xl border border-slate-200 bg-[#F8FAFC] p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Servizio</p>
              <p className="mt-1 font-black">{managed.service?.name || 'Servizio'}</p>
              <p className="mt-1 text-sm text-slate-500">
                {fmtDate(managed.booking.booking_date)} · {managed.booking.booking_time.slice(0, 5)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-slate-200 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Cliente</p>
                <p className="mt-1 text-sm font-black">{managed.booking.customer_name || '—'}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Stato</p>
                <p className="mt-1 text-sm font-black">
                  {managed.booking.status === 'cancelled'
                    ? 'Cancellata'
                    : managed.booking.status === 'pending'
                      ? 'In attesa'
                      : 'Confermata'}
                </p>
              </div>
            </div>

            <div className={[
              'rounded-3xl border p-4 text-sm leading-6',
              managed.canCancel
                ? 'border-[#1FA7A6]/20 bg-[#E6FFFA] text-[#0F766E]'
                : 'border-amber-200 bg-amber-50 text-amber-900',
            ].join(' ')}>
              {stateMessage(managed.cancellationState, managed.noticeHours)}
            </div>

            {managed.canCancel ? <ManageBookingActions slug={slug} token={token} /> : null}

            {!managed.canCancel && managed.cancellationState !== 'cancelled' && (managed.tenant.phone || whatsappHref || managed.tenant.contact_email) ? (
              <div className="grid gap-2 rounded-3xl border border-slate-200 bg-[#F8FAFC] p-4">
                <p className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">Contatta l’attività</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {managed.tenant.phone ? <a href={`tel:${managed.tenant.phone}`} className="rounded-2xl bg-white px-3 py-3 text-center text-sm font-black">📞 Chiama</a> : null}
                  {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-white px-3 py-3 text-center text-sm font-black">💬 WhatsApp</a> : null}
                  {managed.tenant.contact_email ? <a href={`mailto:${managed.tenant.contact_email}`} className="rounded-2xl bg-white px-3 py-3 text-center text-sm font-black">✉️ Email</a> : null}
                </div>
              </div>
            ) : null}

            <Link href={`/t/${slug}`} className="rounded-2xl bg-[#FFC145] px-5 py-3 text-center text-sm font-black shadow-sm">
              Prenota un altro appuntamento
            </Link>
          </div>
        </section>
        <p className="text-center text-xs font-medium text-slate-400">Powered by Slotta</p>
      </div>
    </main>
  )
}
