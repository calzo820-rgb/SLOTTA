import assert from 'node:assert/strict'
import test from 'node:test'
import { runProductionChecks } from '../scripts/check-production.mjs'

function response(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers })
}

test('production monitor verifies home, health and guarded critical endpoints', async () => {
  const requested: string[] = []
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    requested.push(new URL(url).pathname)

    if (url.endsWith('/api/health')) {
      return response({ status: 'ok', service: 'slotta-web' })
    }
    if (url.endsWith('/')) return new Response('<title>Slotta</title>')
    if (url.endsWith('/tester')) return new Response('Vuoi essere ricontattato')
    if (url.endsWith('/login')) return new Response('login')
    if (url.endsWith('/forgot-password')) return new Response('Recupera la password')
    if (url.endsWith('/manifest.json')) return new Response('{"name": "Slotta"}')
    if (url.endsWith('/robots.txt')) return new Response('sitemap.xml')
    if (url.endsWith('/sitemap.xml')) return new Response('https://www.slotta.it')
    if (url.endsWith('/api/webhooks/stripe-billing')) return response({}, 503)

    const requestId = new Headers(init?.headers).get('x-request-id') || ''
    return response(
      { error: 'Richiesta non valida.', error_code: 'INVALID_REQUEST', request_id: requestId },
      400,
      { 'x-request-id': requestId },
    )
  }

  const results = await runProductionChecks({ baseUrl: 'https://example.test/', fetchImpl })

  assert.deepEqual(requested, [
      '/',
      '/api/health',
      '/tester',
      '/login',
      '/forgot-password',
      '/manifest.json',
      '/robots.txt',
      '/sitemap.xml',
      '/api/service-book',
      '/api/webhooks/stripe',
      '/api/webhooks/stripe-billing',
    ])
  assert.equal(results.length, 11)
})

test('production monitor fails when a critical endpoint is unavailable', async () => {
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/api/health')) return response({ status: 'down' }, 503)
    if (url.endsWith('/')) return new Response('<title>Slotta</title>')
    const requestId = new Headers(init?.headers).get('x-request-id') || ''
    return response({ error_code: 'INVALID_REQUEST', request_id: requestId }, 400, {
      'x-request-id': requestId,
    })
  }

  await assert.rejects(
    runProductionChecks({ baseUrl: 'https://example.test', fetchImpl }),
    /health returned HTTP 503/,
  )
})
