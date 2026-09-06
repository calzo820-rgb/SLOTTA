import ServiceBookingPageClient from '@/components/ServiceBookingPageClient'
import { supabaseServer } from '@/lib/supabaseServer'

type Service = {
  id: string
  name: string
  description?: string | null
  duration_minutes: number
  price_cents: number
  image_url?: string | null
  is_active?: boolean | null
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TenantHome({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = supabaseServer()

  const { data: tenants, error: tErr } = await supabase
.from('tenants')
.select(`
  id,
  name,
  slug,
  logo_url,
  address,
  contact_email,
  phone,
  whatsapp_phone,
  instagram_url,
  website_url,
  is_active,
  stripe_connect_charges_enabled,
  stripe_connect_payouts_enabled
`)
    .eq('slug', slug)
    .limit(1)

  if (tErr) {
    return <main className="p-6">Errore: {tErr.message}</main>
  }

  const tenant = tenants?.[0]

  if (!tenant) {
    return <main className="p-6">Locale non trovato.</main>
  }

  if (!tenant.is_active) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
        <div className="max-w-md w-full bg-white border rounded-2xl p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold mb-2">
            Prenotazioni non disponibili
          </h1>
          <p className="text-sm text-zinc-600">
            Il servizio di prenotazione online non è attivo al momento.
          </p>
        </div>
      </main>
    )
  }

  const { data: svcRows, error: sErr } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price_cents, image_url, is_active')
    .eq('tenant_id', tenant.id)
    .order('name', { ascending: true })

  if (sErr) {
    return <main className="p-6">Errore servizi: {sErr.message}</main>
  }

  // Cast rows to Service[] and filter out inactive services
  const services = ((svcRows || []) as Service[]).filter(
    s => s.is_active !== false,
  )

  return (
    <ServiceBookingPageClient
     tenant={{
  id: tenant.id,
  name: tenant.name,
  slug: tenant.slug,
  logo_url: tenant.logo_url,
  address: tenant.address,
  contact_email: tenant.contact_email,
  phone: tenant.phone,
  whatsapp_phone: tenant.whatsapp_phone,
  instagram_url: tenant.instagram_url,
  website_url: tenant.website_url,
  stripe_connect_charges_enabled: tenant.stripe_connect_charges_enabled,
  stripe_connect_payouts_enabled: tenant.stripe_connect_payouts_enabled,
}}
      services={services as Service[]}
    />
  )
}
