import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { hashBusinessAddress } from '@/lib/marketplaceGeocoding'

export const MARKETPLACE_CATEGORIES = ['hairdresser', 'barber', 'beauty'] as const
export type MarketplaceCategory = (typeof MARKETPLACE_CATEGORIES)[number]

const CATEGORY_LABELS: Record<MarketplaceCategory, string> = {
  hairdresser: 'Parrucchiere',
  barber: 'Barber shop',
  beauty: 'Centro estetico',
}

export type MarketplaceSearchInput = {
  q?: string
  city?: string
  category?: string
}

export type MarketplaceResult = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  category: MarketplaceCategory
  categoryLabel: string
  city: string
  provinceCode: string | null
  address: string | null
  postalCode: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
  bookingUrl: string
}

export type MarketplaceSearchResult = {
  items: MarketplaceResult[]
  hasMore: boolean
  error: boolean
  needsLocationOrName: boolean
}

const MAX_RESULTS = 24
const MAX_INPUT_LENGTH = 80

function cleanInput(value: string | undefined): string {
  return (value || '')
    .replace(/[\\%_]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, MAX_INPUT_LENGTH)
}

function toCategory(value: string | undefined): MarketplaceCategory | null | 'invalid' {
  if (!value) return null
  return MARKETPLACE_CATEGORIES.includes(value as MarketplaceCategory)
    ? (value as MarketplaceCategory)
    : 'invalid'
}

function getTenant(row: Record<string, unknown>): Record<string, unknown> | null {
  const related = row.tenant
  if (Array.isArray(related)) {
    return (related[0] as Record<string, unknown> | undefined) ?? null
  }
  return related && typeof related === 'object'
    ? (related as Record<string, unknown>)
    : null
}

export async function searchMarketplace(
  input: MarketplaceSearchInput,
): Promise<MarketplaceSearchResult> {
  const q = cleanInput(input.q)
  const city = cleanInput(input.city)
  const category = toCategory(input.category)

  if (category === 'invalid') {
    return { items: [], hasMore: false, error: false, needsLocationOrName: false }
  }

  // Avoid exposing a directory-wide dump. Each query must target a salon name
  // or a municipality; category refines that search.
  if (!q && !city) {
    return { items: [], hasMore: false, error: false, needsLocationOrName: true }
  }

  try {
    const db = getSupabaseAdmin()
    let query = db
      .from('tenant_marketplace')
      .select(
        'tenant_id, category, description, latitude, longitude, geocode_status, geocoded_address_hash, tenant:tenants!inner(id, name, slug, logo_url, address, city, province, province_code, municipality_code, postal_code, country_code, tenant_mode, is_active)',
      )
      .eq('opt_in', true)
      .eq('tenant.is_active', true)
      .eq('tenant.tenant_mode', 'service')
      .not('category', 'is', null)

    if (category) query = query.eq('category', category)

    if (q) query = query.ilike('tenant.name', `%${q}%`)

    if (city) {
      if (/^[0-9]{6}$/.test(city)) {
        query = query.eq('tenant.municipality_code', city)
      } else {
        query = query.ilike('tenant.city', `${city}%`)
      }
    }

    const { data, error } = await query.limit(MAX_RESULTS + 1)
    if (error) {
      console.error('marketplace search failed', { code: error.code })
      return { items: [], hasMore: false, error: true, needsLocationOrName: false }
    }

    const rows = (data || []) as unknown as Array<Record<string, unknown>>
    const hasMore = rows.length > MAX_RESULTS
    const items = rows
      .slice(0, MAX_RESULTS)
      .flatMap(row => {
        const tenant = getTenant(row)
        const rowCategory = row.category
        if (!tenant || typeof rowCategory !== 'string') return []

        const tenantId = tenant.id
        const name = tenant.name
        const slug = tenant.slug
        const tenantCity = tenant.city
        if (
          typeof tenantId !== 'string' ||
          typeof name !== 'string' ||
          typeof slug !== 'string' ||
          typeof tenantCity !== 'string' ||
          !MARKETPLACE_CATEGORIES.includes(rowCategory as MarketplaceCategory)
        ) {
          return []
        }

        return [{
          id: tenantId,
          name,
          slug,
          logoUrl: typeof tenant.logo_url === 'string' ? tenant.logo_url : null,
          category: rowCategory as MarketplaceCategory,
          categoryLabel: CATEGORY_LABELS[rowCategory as MarketplaceCategory],
          city: tenantCity,
          provinceCode:
            typeof tenant.province_code === 'string' ? tenant.province_code : null,
          address: typeof tenant.address === 'string' ? tenant.address : null,
          postalCode:
            typeof tenant.postal_code === 'string' ? tenant.postal_code : null,
          description:
            typeof row.description === 'string' ? row.description : null,
          ...getCurrentCoordinates(row, tenant),
          bookingUrl: `/t/${encodeURIComponent(slug)}`,
        }]
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'it'))

    return { items, hasMore, error: false, needsLocationOrName: false }
  } catch {
    return { items: [], hasMore: false, error: true, needsLocationOrName: false }
  }
}

function getCurrentCoordinates(
  row: Record<string, unknown>,
  tenant: Record<string, unknown>,
): { latitude: number | null; longitude: number | null } {
  const status = row.geocode_status
  const locationIsCurrent = status === 'manual' || (
    status === 'geocoded' &&
    typeof row.geocoded_address_hash === 'string' &&
    row.geocoded_address_hash === hashBusinessAddress({
      address: typeof tenant.address === 'string' ? tenant.address : null,
      postalCode: typeof tenant.postal_code === 'string' ? tenant.postal_code : null,
      city: typeof tenant.city === 'string' ? tenant.city : null,
      province: typeof tenant.province === 'string' ? tenant.province : null,
      countryCode: typeof tenant.country_code === 'string' ? tenant.country_code : null,
    })
  )
  if (!locationIsCurrent) return { latitude: null, longitude: null }

  const latitude = Number(row.latitude)
  const longitude = Number(row.longitude)
  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) return { latitude: null, longitude: null }

  return { latitude, longitude }
}

