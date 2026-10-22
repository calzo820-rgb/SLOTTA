import { createHash } from 'node:crypto'

export type MarketplaceCoordinateRow = {
  [key: string]: unknown
}

export type MarketplaceAddressRow = {
  address?: unknown
  postal_code?: unknown
  city?: unknown
  province?: unknown
  country_code?: unknown
}

export function getCurrentMarketplaceCoordinates(
  row: MarketplaceCoordinateRow,
  tenant: MarketplaceAddressRow,
): { latitude: number | null; longitude: number | null } {
  const locationIsCurrent = row.geocode_status === 'manual' || (
    row.geocode_status === 'geocoded' &&
    typeof row.geocoded_address_hash === 'string' &&
    row.geocoded_address_hash === hashAddress(tenant)
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

function hashAddress(tenant: MarketplaceAddressRow): string {
  const normalize = (value: unknown) => typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('it-IT')
    : ''
  const canonical = [
    tenant.address,
    tenant.postal_code,
    tenant.city,
    tenant.province,
    tenant.country_code,
  ].map(normalize).join('\n')
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}
