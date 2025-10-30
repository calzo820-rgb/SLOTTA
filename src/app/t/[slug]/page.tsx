// app/t/[slug]/page.tsx
// SERVER COMPONENT (nessun "use client" qui)

import ProductRow from '@/components/ProductRow'
import CartPanel from '@/components/CartPanel'
import { supabase } from '@/lib/supabaseClient'

type Tenant = {
  id: string
  name: string
  slug: string
  primary_color?: string | null
  logo_url?: string | null
}

type ProductRowDB = {
  id: string
  tenant_id: string
  name: string
  ingredients: string | null
  description: string | null
  price_cents: number
  position: number
  is_active: boolean
  image_url: string | null
}

type AddonDB = {
  id: string | number
  tenant_id: string
  name: string
  price_cents: number | null
  is_active?: boolean | null
  position?: number | null
}

/** Utility: trasforma "Pomodoro | Mozzarella | Basilico" -> ["Pomodoro","Mozzarella","Basilico"] */
function splitIngredients(s: string | null | undefined): string[] {
  if (!s) return []
  return s
    .split(/[|,]/g)
    .map(x => x.trim())
    .filter(Boolean)
}

const DEFAULT_COLOR = '#8b0000'

export default async function TenantHome({
  params,
}: {
  params: { slug: string }
}) {
  const slug = params.slug

  // ===== TENANT =====
  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('id,name,slug,primary_color,logo_url')
    .eq('slug', slug)
    .single<Tenant>()

  if (tErr || !tenant) {
    return (
      <main className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-2">Locale non trovato</h1>
        <p className="text-zinc-600">Verifica lo slug nel link.</p>
      </main>
    )
  }

  const themeColor = tenant.primary_color || DEFAULT_COLOR

  // ===== PRODUCTS (solo attivi) =====
  const { data: productsDB, error: pErr } = await supabase
    .from('products')
    .select(
      'id,tenant_id,name,ingredients,description,price_cents,position,is_active,image_url'
    )
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('position', { ascending: true })

  if (pErr) {
    return (
      <main className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-2" style={{ color: themeColor }}>
          {tenant.name}
        </h1>
        <p className="text-red-600">
          Errore caricamento prodotti: {pErr.message}
        </p>
      </main>
    )
  }

  const products = (productsDB || []).map((p: ProductRowDB) => ({
    id: p.id,
    name: p.name,
    price_cents: p.price_cents,
    image_url: p.image_url,
    ingredients: splitIngredients(p.ingredients),
  }))

  // ===== ADDONS & CATALOGO INGREDIENTI (da tenant_addons) =====
  let addons:
    { id: string | number; name: string; price_cents?: number }[] = []
  let ingredientCatalog: string[] = []

  {
    const { data: addDB, error: aErr } = await supabase
      .from('tenant_addons')
      .select('id,name,price_cents,is_active,position')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (!aErr && addDB) {
      addons = (addDB as AddonDB[]).map(a => ({
        id: a.id,
        name: a.name,
        price_cents: a.price_cents || 0,
      }))

      ingredientCatalog = (addDB as AddonDB[])
        .map(a => a.name)
        .filter(Boolean)
    }
  }

  // ===== RENDER =====
  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6">
      <header className="mb-4 flex items-center gap-3">
        {tenant.logo_url && (
          <img
            src={tenant.logo_url}
            alt={tenant.name}
            className="h-8 w-8 object-contain rounded"
          />
        )}
        <h1 className="text-2xl font-bold" style={{ color: themeColor }}>
          {tenant.name}
        </h1>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Prodotti */}
        <section className="md:col-span-2 grid gap-4">
          {products.length === 0 && (
            <div className="text-sm text-zinc-600">
              Nessun prodotto disponibile al momento.
            </div>
          )}

          {products.map(p => (
            <ProductRow
              key={p.id}
              p={p}
              addons={addons}
              ingredientCatalog={ingredientCatalog}
              color={themeColor}
            />
          ))}
        </section>

        {/* Carrello + Fasce orarie */}
        <CartPanel tenantSlug={slug} color={themeColor} />
      </div>
    </main>
  )
}
