import { randomUUID } from 'node:crypto'

const DEFAULT_BASE_URL = 'https://www.slotta.it'
const REQUEST_TIMEOUT_MS = 15_000

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function monitoredFetch(fetchImpl, url, init = {}) {
  return fetchImpl(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

export async function runProductionChecks({
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = fetch,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
  const results = []

  const home = await monitoredFetch(fetchImpl, `${normalizedBaseUrl}/`)
  assert(home.status === 200, `home returned HTTP ${home.status}`)
  const homeBody = await home.text()
  assert(homeBody.includes('Slotta'), 'home does not contain the Slotta marker')
  results.push({ check: 'home', status: home.status })

  const health = await monitoredFetch(fetchImpl, `${normalizedBaseUrl}/api/health`)
  assert(health.status === 200, `health returned HTTP ${health.status}`)
  const healthBody = await health.json()
  assert(healthBody.status === 'ok', 'health status is not ok')
  assert(healthBody.service === 'slotta-web', 'health service marker is invalid')
  results.push({ check: 'health', status: health.status })

  const pageChecks = [
    ['tester', '/tester', 'Vuoi essere ricontattato'],
    ['login', '/login', null],
    ['forgot-password', '/forgot-password', 'Recupera la password'],
    ['manifest', '/manifest.json', '"name": "Slotta"'],
    ['robots', '/robots.txt', 'sitemap.xml'],
    ['sitemap', '/sitemap.xml', 'https://www.slotta.it'],
  ]

  for (const [check, path, marker] of pageChecks) {
    const response = await monitoredFetch(fetchImpl, `${normalizedBaseUrl}${path}`)
    assert(response.status === 200, `${path} returned HTTP ${response.status}`)
    if (marker) {
      const body = await response.text()
      assert(body.includes(marker), `${path} does not contain the expected marker`)
    }
    results.push({ check, status: response.status })
  }

  for (const endpoint of ['/api/service-book', '/api/webhooks/stripe']) {
    const requestId = `monitor-${randomUUID()}`
    const response = await monitoredFetch(fetchImpl, `${normalizedBaseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
      },
      body: '{}',
    })
    assert(response.status === 400, `${endpoint} guard returned HTTP ${response.status}`)
    assert(
      response.headers.get('x-request-id') === requestId,
      `${endpoint} did not preserve the request ID`,
    )
    const body = await response.json()
    assert(body.error_code === 'INVALID_REQUEST', `${endpoint} returned an unstable error code`)
    assert(body.request_id === requestId, `${endpoint} returned a mismatched request ID`)
    results.push({ check: endpoint, status: response.status })
  }

  const billingWebhook = await monitoredFetch(
    fetchImpl,
    `${normalizedBaseUrl}/api/webhooks/stripe-billing`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
  )
  assert(
    billingWebhook.status === 400 || billingWebhook.status === 503,
    `/api/webhooks/stripe-billing returned unexpected HTTP ${billingWebhook.status}; expected 400 when configured or 503 when not configured`,
  )
  results.push({ check: '/api/webhooks/stripe-billing', status: billingWebhook.status })

  return results
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href

if (isMain) {
  runProductionChecks({ baseUrl: process.env.SLOTTA_BASE_URL })
    .then(results => {
      for (const result of results) {
        console.log(`OK ${result.check} (HTTP ${result.status})`)
      }
    })
    .catch(error => {
      console.error(`PRODUCTION CHECK FAILED: ${error instanceof Error ? error.message : error}`)
      process.exitCode = 1
    })
}
