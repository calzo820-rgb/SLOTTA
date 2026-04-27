import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BookingSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { slug } = await params
  const sp = await searchParams

  const bookingId =
    typeof sp.booking === 'string' ? sp.booking : Array.isArray(sp.booking) ? sp.booking[0] : null

  const status =
    typeof sp.status === 'string' ? sp.status : Array.isArray(sp.status) ? sp.status[0] : null

  const { data: tenants, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, name, logo_url, primary_color, slug')
    .eq('slug', slug)
    .limit(1)

  if (tenantErr) {
    return <main className="p-6">Errore: {tenantErr.message}</main>
  }

  const tenant = tenants?.[0]
  if (!tenant) {
    return <main className="p-6">Attività non trovata.</main>
  }

  let booking: any = null

  if (bookingId) {
    const { data, error } = await supabase
      .from('service_bookings')
      .select(
        `
        id,
        booking_date,
        booking_time,
        customer_name,
        status,
        payment_status,
        services(name, duration_minutes, price_cents),
        staff_members(name)
      `,
      )
      .eq('id', bookingId)
      .eq('tenant_id', tenant.id)
      .maybeSingle()

    if (!error) {
      booking = data
    }
  }

  const mainColor = tenant.primary_color || '#18181b'
  const isSuccess = status === 'success'
  const isCancel = status === 'cancel'

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="h-10 w-10 rounded bg-white border object-contain"
            />
          ) : null}

          <div>
            <div className="text-sm text-zinc-500">Prenotazione online</div>
            <h1 className="text-2xl font-bold" style={{ color: mainColor }}>
              {tenant.name}
            </h1>
          </div>
        </div>

        <div className="rounded-2xl border bg-white shadow-sm p-6 grid gap-5">
          <div className="grid gap-2 text-center">
            <div className="text-5xl">{isCancel ? '⏸️' : '✅'}</div>

            <h2 className="text-2xl font-bold" style={{ color: mainColor }}>
              {isCancel ? 'Pagamento annullato' : 'Prenotazione ricevuta'}
            </h2>

            <p className="text-sm text-zinc-600 max-w-lg mx-auto">
  {isCancel
    ? 'La richiesta di prenotazione è stata registrata, ma il pagamento non è stato completato. Puoi tornare alla prenotazione e riprovare in qualsiasi momento.'
    : 'La tua richiesta è stata registrata correttamente. Qui sotto trovi il riepilogo del tuo appuntamento.'}
</p>
          </div>

          {booking ? (
            <div className="rounded-xl border bg-zinc-50 p-4 grid gap-4">
              <div className="text-sm font-semibold text-zinc-800">Riepilogo prenotazione</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Cliente</div>
                  <div className="font-medium">{booking.customer_name || '-'}</div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Servizio</div>
                  <div className="font-medium">{booking.services?.name || '-'}</div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Data</div>
                  <div className="font-medium">{booking.booking_date || '-'}</div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Orario</div>
                  <div className="font-medium">{String(booking.booking_time || '').slice(0, 5) || '-'}</div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Operatore</div>
                  <div className="font-medium">{booking.staff_members?.name || 'Assegnazione automatica'}</div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Pagamento</div>
                  <div
  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
  style={{
    background:
      booking.payment_status === 'paid'
        ? '#dcfce7'
        : booking.payment_status === 'unpaid'
        ? '#fef3c7'
        : '#f4f4f5',
    color:
      booking.payment_status === 'paid'
        ? '#166534'
        : booking.payment_status === 'unpaid'
        ? '#92400e'
        : '#3f3f46',
  }}
>
  {booking.payment_status === 'paid'
    ? 'Pagato'
    : booking.payment_status === 'unpaid'
    ? 'Da completare'
    : booking.payment_status || '-'}
</div>
                </div>
              </div>

              {typeof booking.services?.price_cents === 'number' ? (
                <div className="pt-2 border-t text-sm flex items-center justify-between">
                  <span className="text-zinc-600">Totale</span>
                  <span className="font-semibold">
                    € {(booking.services.price_cents / 100).toFixed(2)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border bg-zinc-50 p-4 text-sm text-zinc-600">
              Non siamo riusciti a caricare il riepilogo completo, ma la richiesta è stata gestita.
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
  {isCancel ? (
    <div className="grid gap-2">
      <p>
        Nessun problema: il pagamento non è andato a buon fine o è stato interrotto prima del completamento.
      </p>
      <p>
        Puoi tornare alla prenotazione e scegliere di nuovo se pagare online oppure, se previsto dal salone, pagare direttamente in sede.
      </p>
    </div>
  ) : (
    <div className="grid gap-2">
      <p>
        Riceverai una conferma via email con i dettagli della tua richiesta.
      </p>
      <p>
        Se il salone prevede conferma manuale, il tuo appuntamento verrà verificato dal personale prima della conferma finale.
      </p>
    </div>
  )}
</div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
  <a
    href={`/t/${tenant.slug}`}
    className="inline-flex items-center justify-center px-4 py-3 rounded-xl text-white font-medium"
    style={{ background: mainColor }}
  >
    {isCancel ? 'Torna e riprova il pagamento' : 'Torna alle prenotazioni'}
  </a>

  <a
    href={`/t/${tenant.slug}`}
    className="inline-flex items-center justify-center px-4 py-3 rounded-xl border font-medium text-zinc-700 bg-white"
  >
    Prenota un altro servizio
  </a>
</div>
          </div>
        </div>
      </div>
    </main>
  )
}