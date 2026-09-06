import { createHash } from 'node:crypto'

export function hashRateLimitIdentity(scope: string, ip: string) {
  return createHash('sha256').update(`${scope}\0${ip}`).digest('hex')
}

export async function readJsonBody(
  request: Request,
  maxBytes = 16_384,
): Promise<Record<string, unknown> | null> {
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > maxBytes) return null

  const text = await request.text()
  if (!text || new TextEncoder().encode(text).byteLength > maxBytes) return null

  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export async function enforceDistributedRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): Promise<Response | null> {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  const bucketKey = hashRateLimitIdentity(scope, ip)
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000))

  const { supabaseAdmin } = await import('@/lib/supabaseAdmin')
  const { data, error } = await supabaseAdmin
    .rpc('consume_api_rate_limit', {
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    .single()

  const result = data as
    | { allowed?: boolean; retry_after_seconds?: number }
    | null

  if (error || !result) {
    console.error('distributed rate limit failed', {
      scope,
      code: error?.code || 'NO_DATA',
    })
    return Response.json(
      { error: 'Servizio temporaneamente non disponibile.' },
      { status: 503, headers: { 'Retry-After': '5' } },
    )
  }

  if (result.allowed === true) return null

  const retryAfter = Math.max(1, Number(result.retry_after_seconds) || 1)
  return Response.json(
    { error: 'Troppe richieste. Riprova tra poco.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}
