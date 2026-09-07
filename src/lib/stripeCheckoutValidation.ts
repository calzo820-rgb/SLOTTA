export type StripeCheckoutSessionLike = {
  id: string
  mode: string | null
  payment_status: string
  amount_total: number | null
  currency: string | null
  payment_intent: string | { id?: string } | null
  metadata: Record<string, string> | null
}

export type PaidCheckoutDetails = {
  holdId: string
  tenantId: string
  stripeAccountId: string
  sessionId: string
  paymentIntentId: string
  amountTotal: number
  currency: string
}

export function getPaidCheckoutDetails(
  session: StripeCheckoutSessionLike,
  eventAccountId: string | null,
): PaidCheckoutDetails | null {
  const holdId = session.metadata?.hold_id?.trim()
  const tenantId = session.metadata?.tenant_id?.trim()
  const metadataAccountId =
    session.metadata?.stripe_connect_account_id?.trim()
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id

  if (
    session.mode !== 'payment' ||
    session.payment_status !== 'paid' ||
    !Number.isSafeInteger(session.amount_total) ||
    (session.amount_total ?? 0) <= 0 ||
    !session.currency ||
    session.currency !== session.currency.toLowerCase() ||
    !holdId ||
    !tenantId ||
    !metadataAccountId ||
    !eventAccountId ||
    metadataAccountId !== eventAccountId ||
    !paymentIntentId
  ) {
    return null
  }

  return {
    holdId,
    tenantId,
    stripeAccountId: metadataAccountId,
    sessionId: session.id,
    paymentIntentId,
    amountTotal: session.amount_total as number,
    currency: session.currency,
  }
}

export function isStripeFinalizationError(error: unknown) {
  const candidate = error as { message?: unknown; details?: unknown }
  const text = `${String(candidate?.message || '')} ${String(candidate?.details || '')}`

  return /SLOTTA_(INVALID_STRIPE_(PAYMENT|EVENT|REFUND|DISPUTE)|STRIPE_PAYMENT_MISMATCH|HOLD_NOT_FOUND|HOLD_NOT_PENDING|BOOKING_NOT_FOUND|TENANT_NOT_FOUND)/.test(
    text,
  )
}
