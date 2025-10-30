import { supabase } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OrderSuccessPage(
  { params, searchParams }: { params: Promise<{ slug: string }>, searchParams: Promise<{ [key: string]: string }> }
) {
  const { slug } = await params
  const sp = await searchParams
  const orderId = sp.order

  // Tenant (per testata)
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, logo_url, primary_color')
    .eq('slug', slug)
    .limit(1)
  const tenant = tenants?.[0]
  if (!tenant) return <main className="p-6">Locale non trovato.</main>

  if (!orderId) {
    return (
      <main className="max-w-xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold" style={{ color: tenant.primary_color }}>Ordine completato</h1>
        <p className="mt-2">Grazie! Torna al <a className="underline" href={`/t/${slug}`}>menù</a>.</p>
      </main>
    )
  }

  // Ordine (mostriamo numero e orario)
  const { data: order } = await supabase
    .from('orders')
    .select('order_number, ready_by, total_cents, payment_status')
    .eq('id', orderId)
    .limit(1)
    .single()

  return (
    <main className="max-w-xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-4">
        {tenant.logo_url && <img src={tenant.logo_url} alt={tenant.name} className="h-10 w-10 object-contain" />}
        <h1 className="text-2xl font-bold" style={{ color: tenant.primary_color }}>{tenant.name}</h1>
      </div>

      <div className="border rounded p-4 bg-white">
        <div className="text-lg font-semibold">Grazie per l’ordine!</div>

        {order?.order_number && (
          <div className="mt-2">
            Numero ordine: <span className="font-bold">{order.order_number}</span>
          </div>
        )}

        {order?.ready_by && (
          <div className="mt-1 text-zinc-700">
            Ritiro: <span className="font-medium">
              {new Date(order.ready_by).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {typeof order?.total_cents === 'number' && (
          <div className="mt-1 text-zinc-700">
            Totale: <span className="font-medium">€ {(order.total_cents/100).toFixed(2)}</span>
          </div>
        )}

        {order?.payment_status && (
          <div className="mt-1 text-zinc-700">
            Pagamento: <span className="font-medium">{order.payment_status === 'paid' ? 'Confermato' : 'In attesa'}</span>
          </div>
        )}

        <a
          href={`/t/${slug}`}
          className="mt-4 inline-block px-4 py-2 rounded text-white"
          style={{ background: tenant.primary_color }}
        >
          Torna al menù
        </a>
      </div>
    </main>
  )
}
