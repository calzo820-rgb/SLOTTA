import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
  booking?: string
  status?: string
  session_id?: string
}>
}

type BookingRow = {
  id: string
  service_id: string
  customer_name: string | null
  customer_email: string | null
  booking_date: string | null
  booking_time: string | null
  status: 'pending' | 'confirmed' | 'done' | 'cancelled' | null
  payment_status: 'unpaid' | 'paid' | 'pending' | null
}

type ServiceRow = {
  name: string
  duration_minutes: number
  price_cents: number
}

function fmtDate(d?: string | null) {
  if (!d) return '—'

  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return d
  }
}

function fmtTime(t?: string | null) {
  if (!t) return '—'

  const parts = String(t).split(':')
  return `${parts[0] || '00'}:${parts[1] || '00'}`
}

function bookingStatusLabel(status?: string | null) {
  if (status === 'confirmed') return 'Confermata'
  if (status === 'done') return 'Confermata'
  if (status === 'cancelled') return 'Cancellata'
  return 'In attesa'
}

function paymentStatusLabel(status?: string | null) {
  if (status === 'paid') return 'Pagato online'
  if (status === 'pending') return 'Pagamento in verifica'
  return 'Da pagare in salone'
}

export default async function BookingSuccessPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params
  const sp = await searchParams

  const bookingId = sp.booking || ''
  const sessionId = sp.session_id || ''

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, name, slug, logo_url')
    .eq('slug', slug)
    .maybeSingle()

  let booking: BookingRow | null = null
  let service: ServiceRow | null = null

  if (bookingId) {
    const { data: bookingRow } = await supabaseAdmin
      .from('service_bookings')
      .select(
        'id, service_id, customer_name, customer_email, booking_date, booking_time, status, payment_status',
      )
      .eq('id', bookingId)
      .eq('tenant_id', tenant?.id || '')
      .maybeSingle()

    booking = bookingRow as BookingRow | null

    if (booking?.service_id) {
      const { data: serviceRow } = await supabaseAdmin
        .from('services')
        .select('name, duration_minutes, price_cents')
        .eq('id', booking.service_id)
        .maybeSingle()

      service = serviceRow as ServiceRow | null
    }
  }
if (!booking && sessionId) {
  const { data: bookingRow } = await supabaseAdmin
    .from('service_bookings')
    .select(
      'id, service_id, customer_name, customer_email, booking_date, booking_time, status, payment_status',
    )
    .eq('stripe_session_id', sessionId)
    .eq('tenant_id', tenant?.id || '')
    .maybeSingle()

  booking = bookingRow as BookingRow | null

  if (booking?.service_id) {
    const { data: serviceRow } = await supabaseAdmin
      .from('services')
      .select('name, duration_minutes, price_cents')
      .eq('id', booking.service_id)
      .maybeSingle()

    service = serviceRow as ServiceRow | null
  }
}
  const isPaid = booking?.payment_status === 'paid'
  const isConfirmed = booking?.status === 'confirmed'
  const isCancelled = booking?.status === 'cancelled'

  const title = isCancelled
    ? 'Prenotazione cancellata'
    : isPaid
      ? 'Pagamento completato'
      : isConfirmed
        ? 'Prenotazione confermata'
        : 'Richiesta inviata'

  const subtitle = isCancelled
    ? 'Questa prenotazione risulta cancellata. Contatta l’attività per maggiori informazioni.'
    : isPaid
      ? 'Il pagamento è andato a buon fine e la prenotazione è stata registrata.'
      : isConfirmed
        ? 'La tua prenotazione è stata registrata correttamente.'
        : 'Abbiamo ricevuto la tua richiesta. L’attività ti confermerà l’appuntamento.'

  return (
    <main className="min-h-screen bg-[#F2F4F7] px-4 py-8 text-[#0F1D2D]">
      <div className="mx-auto grid max-w-xl gap-5">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-[#0F1D2D] px-6 py-8 text-center text-white">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFC145] text-3xl text-[#0F1D2D]">
              {isCancelled ? '!' : '✓'}
            </div>

            <h1 className="text-2xl font-black">{title}</h1>

            <p className="mt-2 text-sm leading-6 text-white/80">
              {subtitle}
            </p>
          </div>

          <div className="grid gap-4 p-6">
            <div className="rounded-3xl border border-slate-200 bg-[#F8FAFC] p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Attività
              </p>
              <p className="mt-1 font-black">{tenant?.name || '—'}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Giorno
                </p>
                <p className="mt-1 text-sm font-black">
                  {fmtDate(booking?.booking_date)}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Orario
                </p>
                <p className="mt-1 text-sm font-black">
                  {fmtTime(booking?.booking_time)}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Servizio
              </p>

              <p className="mt-1 font-black">{service?.name || '—'}</p>

              {service ? (
                <p className="mt-1 text-sm text-slate-500">
                  {service.duration_minutes} min · €{' '}
                  {(service.price_cents / 100).toFixed(2)}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Stato
                </p>
                <p className="mt-1 text-sm font-black">
                  {bookingStatusLabel(booking?.status)}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Pagamento
                </p>
                <p className="mt-1 text-sm font-black">
                  {paymentStatusLabel(booking?.payment_status)}
                </p>
              </div>
            </div>

            {booking?.customer_email ? (
              <div className="rounded-3xl border border-[#1FA7A6]/20 bg-[#E6FFFA] p-4 text-sm leading-6 text-[#0F766E]">
                Ti abbiamo inviato una email di riepilogo a{' '}
                <span className="font-black">{booking.customer_email}</span>.
              </div>
            ) : null}

            {!isCancelled ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                <span className="font-black">Nota:</span>{' '}
                se hai bisogno di modificare o annullare l’appuntamento,
                contatta direttamente l’attività.
              </div>
            ) : null}

            <Link
              href={`/t/${slug}`}
              className="rounded-2xl bg-[#FFC145] px-5 py-3 text-center text-sm font-black text-[#0F1D2D] shadow-sm transition hover:brightness-95"
            >
              Torna alla pagina prenotazioni
            </Link>
          </div>
        </section>

        <p className="text-center text-xs font-medium text-slate-400">
          Powered by Slotta
        </p>
      </div>
    </main>
  )
}
