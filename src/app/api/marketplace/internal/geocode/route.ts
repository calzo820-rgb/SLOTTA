import { NextResponse } from 'next/server'
import { hasMarketplaceInternalAccess } from '@/lib/marketplaceAccess'
import {
  buildBusinessAddressQuery,
  geocodeWithNominatim,
  hashBusinessAddress,
} from '@/lib/marketplaceGeocoding'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function unavailable() {
  return NextResponse.json({ error: 'Geocodifica interna non disponibile.' }, { status: 503 })
}

export async function POST(request: Request) {
  if (
    process.env.MARKETPLACE_GEOCODING_ENABLED?.trim().toLowerCase() !== 'true' ||
    !(await hasMarketplaceInternalAccess())
  ) {
    return NextResponse.json({ error: 'Non trovato.' }, { status: 404 })
  }

  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 403 })
  }

  const provider = process.env.MARKETPLACE_GEOCODING_PROVIDER?.trim().toLowerCase()
  const userAgent = process.env.MARKETPLACE_GEOCODING_USER_AGENT?.trim()
  if (provider !== 'nominatim' || !userAgent) return unavailable()

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 1024) {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 413 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
  }
  const tenantId = body && typeof body === 'object'
    ? (body as Record<string, unknown>).tenantId
    : null
  if (typeof tenantId !== 'string' || !UUID_PATTERN.test(tenantId)) {
    return NextResponse.json({ error: 'Identificativo attività non valido.' }, { status: 400 })
  }

  try {
    const db = getSupabaseAdmin()
    const { data: tenant, error: tenantError } = await db
      .from('tenants')
      .select('id, address, city, province, postal_code, country_code, is_active, tenant_mode')
      .eq('id', tenantId)
      .maybeSingle()
    if (tenantError) throw tenantError
    if (!tenant || tenant.is_active !== true || tenant.tenant_mode !== 'service') {
      return NextResponse.json({ error: 'Attività non trovata.' }, { status: 404 })
    }

    const { data: settings, error: settingsError } = await db
      .from('tenant_marketplace')
      .select('opt_in, latitude, longitude, geocode_status, geocoded_address_hash')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (settingsError) throw settingsError
    if (!settings?.opt_in) {
      return NextResponse.json({ error: 'Attività non aderente al Marketplace.' }, { status: 409 })
    }

    const address = {
      address: typeof tenant.address === 'string' ? tenant.address : null,
      postalCode: typeof tenant.postal_code === 'string' ? tenant.postal_code : null,
      city: typeof tenant.city === 'string' ? tenant.city : null,
      province: typeof tenant.province === 'string' ? tenant.province : null,
      countryCode: typeof tenant.country_code === 'string' ? tenant.country_code : null,
    }
    const query = buildBusinessAddressQuery(address)
    if (!query) {
      return NextResponse.json({ error: 'Completa indirizzo e Comune prima della geocodifica.' }, { status: 422 })
    }

    const addressHash = hashBusinessAddress(address)
    const latitude = Number(settings.latitude)
    const longitude = Number(settings.longitude)
    if (
      settings.latitude != null && settings.longitude != null &&
      settings.geocoded_address_hash === addressHash &&
      Number.isFinite(latitude) && Number.isFinite(longitude)
    ) {
      return NextResponse.json({ latitude, longitude, cached: true })
    }

    const { data: slotAvailable, error: gateError } = await db.rpc('marketplace_claim_geocoding_slot')
    if (gateError) throw gateError
    if (slotAvailable !== true) {
      return NextResponse.json(
        { error: 'Attendi un secondo prima di richiedere un’altra posizione.' },
        { status: 429, headers: { 'Retry-After': '1' } },
      )
    }

    const { error: pendingError } = await db
      .from('tenant_marketplace')
      .update({
        geocode_status: 'pending',
        latitude: null,
        longitude: null,
        location_source: null,
        geocoded_at: null,
        geocoded_address_hash: null,
      })
      .eq('tenant_id', tenantId)
    if (pendingError) throw pendingError

    let coordinates
    try {
      coordinates = await geocodeWithNominatim(query, {
        endpoint: process.env.MARKETPLACE_NOMINATIM_ENDPOINT,
        userAgent,
      })
    } catch (error) {
      await db.from('tenant_marketplace')
        .update({ geocode_status: 'failed' })
        .eq('tenant_id', tenantId)
      console.error('marketplace geocoding provider failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      })
      return unavailable()
    }

    // The address or opt-in may change while the provider request is in flight.
    // Never attach a result to a different address or a now-withdrawn listing.
    const [{ data: latestTenant, error: latestTenantError }, { data: latestSettings, error: latestSettingsError }] =
      await Promise.all([
        db.from('tenants')
          .select('address, city, province, postal_code, country_code, is_active, tenant_mode')
          .eq('id', tenantId)
          .maybeSingle(),
        db.from('tenant_marketplace')
          .select('opt_in')
          .eq('tenant_id', tenantId)
          .maybeSingle(),
      ])
    if (latestTenantError) throw latestTenantError
    if (latestSettingsError) throw latestSettingsError
    const latestAddress = {
      address: typeof latestTenant?.address === 'string' ? latestTenant.address : null,
      postalCode: typeof latestTenant?.postal_code === 'string' ? latestTenant.postal_code : null,
      city: typeof latestTenant?.city === 'string' ? latestTenant.city : null,
      province: typeof latestTenant?.province === 'string' ? latestTenant.province : null,
      countryCode: typeof latestTenant?.country_code === 'string' ? latestTenant.country_code : null,
    }
    if (
      !latestTenant || latestTenant.is_active !== true || latestTenant.tenant_mode !== 'service' ||
      !latestSettings?.opt_in || hashBusinessAddress(latestAddress) !== addressHash
    ) {
      return NextResponse.json(
        { error: 'Indirizzo o adesione modificati durante la richiesta; riprova.' },
        { status: 409 },
      )
    }

    if (!coordinates) {
      const { error } = await db.from('tenant_marketplace')
        .update({ geocode_status: 'failed' })
        .eq('tenant_id', tenantId)
      if (error) throw error
      return NextResponse.json({ error: 'Indirizzo non riconosciuto; usa coordinate inserite manualmente.' }, { status: 422 })
    }

    const { error: updateError } = await db
      .from('tenant_marketplace')
      .update({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        geocode_status: 'geocoded',
        location_source: 'provider',
        geocoded_at: new Date().toISOString(),
        geocoded_address_hash: addressHash,
      })
      .eq('tenant_id', tenantId)
    if (updateError) throw updateError

    return NextResponse.json({ ...coordinates, cached: false })
  } catch (error) {
    console.error('marketplace geocoding request failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
    return unavailable()
  }
}
