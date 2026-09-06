import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_CONTEXT = 'slotta:checkout-hold-cancel:v1'

export function createHoldCancelToken(
  holdId: string,
  expiresAt: Date,
  secret: string,
) {
  const expiresAtSeconds = Math.floor(expiresAt.getTime() / 1000)
  const payload = `${TOKEN_CONTEXT}:${holdId}:${expiresAtSeconds}`
  const signature = createHmac('sha256', secret)
    .update(payload)
    .digest('base64url')

  return `${expiresAtSeconds}.${signature}`
}

export function verifyHoldCancelToken(
  holdId: string,
  token: string,
  secret: string,
  now = Date.now(),
) {
  const separator = token.indexOf('.')
  if (separator <= 0 || separator === token.length - 1) return false

  const expiresRaw = token.slice(0, separator)
  const suppliedSignature = token.slice(separator + 1)
  if (!/^\d{10}$/.test(expiresRaw) || !/^[A-Za-z0-9_-]{43}$/.test(suppliedSignature)) {
    return false
  }

  const expiresAtSeconds = Number(expiresRaw)
  if (!Number.isSafeInteger(expiresAtSeconds) || expiresAtSeconds * 1000 < now) {
    return false
  }

  const payload = `${TOKEN_CONTEXT}:${holdId}:${expiresAtSeconds}`
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('base64url')

  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
