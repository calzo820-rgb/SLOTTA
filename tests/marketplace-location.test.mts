import assert from 'node:assert/strict'
import test from 'node:test'
import { getCurrentMarketplaceCoordinates } from '../src/lib/marketplaceLocation.ts'
import { hashBusinessAddress } from '../src/lib/marketplaceGeocoding.ts'

const address = {
  address: 'Via Roma 10',
  postal_code: '20100',
  city: 'Milano',
  province: 'MI',
  country_code: 'IT',
}

const validLocation = {
  latitude: 45.4642,
  longitude: 9.19,
  geocode_status: 'geocoded',
  geocoded_address_hash: hashBusinessAddress({
    address: address.address,
    postalCode: address.postal_code,
    city: address.city,
    province: address.province,
    countryCode: address.country_code,
  }),
}

test('shows geocoded coordinates only while they match the current address', () => {
  assert.deepEqual(getCurrentMarketplaceCoordinates(validLocation, address), {
    latitude: 45.4642,
    longitude: 9.19,
  })

  assert.deepEqual(getCurrentMarketplaceCoordinates(validLocation, {
    ...address,
    address: 'Via Torino 20',
  }), { latitude: null, longitude: null })
})

test('hides pending, stale, failed and missing coordinates', () => {
  for (const status of ['pending', 'stale', 'failed', 'missing']) {
    assert.deepEqual(getCurrentMarketplaceCoordinates({
      ...validLocation,
      geocode_status: status,
    }, address), { latitude: null, longitude: null })
  }
})

test('accepts manual coordinates but rejects invalid coordinate pairs', () => {
  assert.deepEqual(getCurrentMarketplaceCoordinates({
    ...validLocation,
    geocode_status: 'manual',
    geocoded_address_hash: null,
  }, address), { latitude: 45.4642, longitude: 9.19 })

  assert.deepEqual(getCurrentMarketplaceCoordinates({
    ...validLocation,
    latitude: 95,
  }, address), { latitude: null, longitude: null })
})
