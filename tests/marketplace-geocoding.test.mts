import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBusinessAddressQuery,
  geocodeWithNominatim,
  hashBusinessAddress,
  parseNominatimCoordinates,
} from '../src/lib/marketplaceGeocoding.ts'

const address = {
  address: '  Via Roma  10 ',
  postalCode: '10121',
  city: 'Torino',
  province: 'TO',
  countryCode: 'IT',
}

test('builds a bounded address query from business location fields', () => {
  assert.equal(buildBusinessAddressQuery(address), 'Via Roma 10, 10121, Torino, TO, Italia')
  assert.equal(buildBusinessAddressQuery({ ...address, address: null }), null)
  assert.equal(buildBusinessAddressQuery({ ...address, city: '' }), null)
})

test('hashes normalized business addresses consistently', () => {
  assert.equal(hashBusinessAddress(address), hashBusinessAddress({
    ...address,
    address: 'Via Roma 10',
    postalCode: ' 10121 ',
  }))
  assert.notEqual(hashBusinessAddress(address), hashBusinessAddress({ ...address, city: 'Milano' }))
  assert.match(hashBusinessAddress(address), /^[0-9a-f]{64}$/)
})

test('accepts only valid coordinates from a Nominatim result', () => {
  assert.deepEqual(parseNominatimCoordinates([{ lat: '45.07', lon: '7.68' }]), {
    latitude: 45.07,
    longitude: 7.68,
  })
  assert.equal(parseNominatimCoordinates([]), null)
  assert.equal(parseNominatimCoordinates([{ lat: '91', lon: '7' }]), null)
  assert.equal(parseNominatimCoordinates([{ lat: '45', lon: 'NaN' }]), null)
})

test('sends a single explicit search with an identifying User-Agent', async () => {
  let requestedUrl: URL | null = null
  let requestedAgent = ''
  const fetcher: typeof fetch = async (input, init) => {
    requestedUrl = new URL(String(input))
    requestedAgent = new Headers(init?.headers).get('User-Agent') || ''
    return new Response(JSON.stringify([{ lat: '45.0703', lon: '7.6869' }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = await geocodeWithNominatim('Via Roma 10, Torino, IT', {
    userAgent: 'Slotta Marketplace test (https://www.slotta.it)',
    fetcher,
  })

  assert.deepEqual(result, { latitude: 45.0703, longitude: 7.6869 })
  assert.equal(requestedUrl?.searchParams.get('format'), 'jsonv2')
  assert.equal(requestedUrl?.searchParams.get('limit'), '1')
  assert.equal(requestedUrl?.searchParams.get('q'), 'Via Roma 10, Torino, IT')
  assert.match(requestedAgent, /^Slotta Marketplace test/)
})

test('rejects insecure provider endpoints and reports provider errors', async () => {
  await assert.rejects(
    geocodeWithNominatim('Torino', { endpoint: 'http://nominatim.example/search', userAgent: 'Slotta test' }),
    /HTTPS/,
  )
  await assert.rejects(
    geocodeWithNominatim('Torino', {
      userAgent: 'Slotta test',
      fetcher: async () => new Response('', { status: 429 }),
    }),
    /returned 429/,
  )
})
