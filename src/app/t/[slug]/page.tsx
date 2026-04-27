import { createClient } from '@supabase/supabase-js'
import ServiceBookingPageClient from '@/components/ServiceBookingPageClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

  const { data: tenants, error: tErr } = await supabase
    .from('tenants')
    .select('id, name, logo_url, primary_color, slug, address')
    .eq('slug', slug)
    .limit(1)

  if (tErr) {
    return <main className="p-6">Errore: {tErr.message}</main>
  }

  const tenant = tenants?.[0]
  if (!tenant) return <main className="p-6">Locale non trovato.</main>

  const { data: svcRows, error: sErr } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price_cents, image_url, is_active')
    .eq('tenant_id', tenant.id)
    .order('name', { ascending: true })

  if (sErr) {
    return <main className="p-6">Errore servizi: {sErr.message}</main>
  }

  const services = (svcRows || []).filter((s: any) => s.is_active !== false)

 return (
  <ServiceBookingPageClient
    tenant={{
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logo_url: tenant.logo_url,
      primary_color: tenant.primary_color,
      address: tenant.address,
    }}
    services={services as Service[]}
  />
)
}