type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

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

export function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): Response | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  const key = `${scope}:${ip}`
  const now = Date.now()
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    pruneBuckets(now)
    return null
  }

  current.count += 1
  if (current.count <= limit) return null

  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  return Response.json(
    { error: 'Troppe richieste. Riprova tra poco.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}

function pruneBuckets(now: number) {
  if (buckets.size < 1_000) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}
