import { createHash } from 'node:crypto'

export type BusinessAddress = {
  address: string | null
  postalCode: string | null
  city: string | null
  province: string | null
  countryCode: string | null
}

export type Coordinates = { latitude: number; longitude: number }

function normalizePart(value: string | null): string {
  return (value || '').normalize('NFKC').trim().replace(/\s+/g, ' ')
}

export function buildBusinessAddressQuery(address: BusinessAddress): string | null {
  const street = normalizePart(address.address)
  const city = normalizePart(address.city)
  if (!street || !city) return null
  const countryCode = normalizePart(address.countryCode).toUpperCase()
  const country = countryCode === 'IT' ? 'Italia' : countryCode

  return [
    street,
    normalizePart(address.postalCode),
    city,
    normalizePart(address.province),
    country,
  ].filter(Boolean).join(', ').slice(0, 300)
}

export function hashBusinessAddress(address: BusinessAddress): string {
  const canonical = [
    address.address,
    address.postalCode,
    address.city,
    address.province,
    address.countryCode,
  ].map(value => normalizePart(value).toLocaleLowerCase('it-IT')).join('\n')
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

export function parseNominatimCoordinates(payload: unknown): Coordinates | null {
  if (!Array.isArray(payload) || payload.length === 0) return null
  const first = payload[0]
  if (!first || typeof first !== 'object') return null

  const latitude = Number((first as Record<string, unknown>).lat)
  const longitude = Number((first as Record<string, unknown>).lon)
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 ||
    longitude < -180 || longitude > 180
  ) return null

  return { latitude, longitude }
}

export async function geocodeWithNominatim(
  query: string,
  options: {
    endpoint?: string
    userAgent: string
    fetcher?: typeof fetch
  },
): Promise<Coordinates | null> {
  const endpoint = options.endpoint || 'https://nominatim.openstreetmap.org/search'
  const url = new URL(endpoint)
  if (url.protocol !== 'https:') throw new Error('Geocoding endpoint must use HTTPS')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('q', query)

  const response = await (options.fetcher || fetch)(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': options.userAgent,
    },
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Geocoding provider returned ${response.status}`)
  return parseNominatimCoordinates(await response.json())
}
