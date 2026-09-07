import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'

type ApiHandler = (request: Request) => Promise<Response> | Response

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/
const requestContext = new AsyncLocalStorage<{ route: string; requestId: string }>()

function errorCodeForStatus(status: number) {
  if (status === 400 || status === 422) return 'INVALID_REQUEST'
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 429) return 'RATE_LIMITED'
  return 'INTERNAL_ERROR'
}

function requestIdFor(request: Request) {
  const supplied = request.headers.get('x-request-id')?.trim() || ''
  return REQUEST_ID_PATTERN.test(supplied) ? supplied : randomUUID()
}

function logCompletion(input: {
  route: string
  requestId: string
  status: number
  startedAt: number
  errorName?: string
}) {
  const entry = JSON.stringify({
    level: input.status >= 500 ? 'error' : 'info',
    event: input.status >= 400 ? 'api_request_rejected' : 'api_request_completed',
    route: input.route,
    requestId: input.requestId,
    status: input.status,
    durationMs: Date.now() - input.startedAt,
    ...(input.errorName ? { errorName: input.errorName } : {}),
  })

  if (input.status >= 500) console.error(entry)
  else console.log(entry)
}

async function addPublicErrorDetails(response: Response, requestId: string) {
  if (
    response.status < 400 ||
    !response.headers.get('content-type')?.includes('application/json')
  ) {
    response.headers.set('x-request-id', requestId)
    return response
  }

  const body = (await response.clone().json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  if (!body || Array.isArray(body)) {
    response.headers.set('x-request-id', requestId)
    return response
  }

  const headers = new Headers(response.headers)
  headers.set('x-request-id', requestId)

  if (response.status >= 500) {
    return Response.json(
      {
        error: 'Errore interno del server.',
        error_code: 'INTERNAL_ERROR',
        request_id: requestId,
      },
      { status: response.status, headers },
    )
  }

  return Response.json(
    {
      ...body,
      error_code:
        typeof body.error_code === 'string'
          ? body.error_code
          : errorCodeForStatus(response.status),
      request_id: requestId,
    },
    { status: response.status, headers },
  )
}

export function observeApiRoute(route: string, handler: ApiHandler): ApiHandler {
  return async request => {
    const startedAt = Date.now()
    const requestId = requestIdFor(request)

    return requestContext.run({ route, requestId }, async () => {
      try {
        const response = await handler(request)
        const observedResponse = await addPublicErrorDetails(response, requestId)
        logCompletion({ route, requestId, status: observedResponse.status, startedAt })
        return observedResponse
      } catch (error: unknown) {
        const errorName = error instanceof Error ? error.name : 'UnknownError'
        logCompletion({ route, requestId, status: 500, startedAt, errorName })

        return Response.json(
          {
            error: 'Errore interno del server.',
            error_code: 'INTERNAL_ERROR',
            request_id: requestId,
          },
          { status: 500, headers: { 'x-request-id': requestId } },
        )
      }
    })
  }
}

export function logApiEvent(
  event: string,
  level: 'info' | 'warn' | 'error' = 'warn',
) {
  const context = requestContext.getStore()
  const entry = JSON.stringify({
    level,
    event,
    route: context?.route || 'unknown',
    requestId: context?.requestId || 'unknown',
  })

  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.log(entry)
}
