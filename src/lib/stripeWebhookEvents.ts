export type StripeReference = string | { id?: string } | null

export type CheckoutLifecycleSession = {
  id: string
  metadata: Record<string, string> | null
}

export function getCheckoutLifecycleDetails(
  session: CheckoutLifecycleSession,
  eventAccountId: string | null,
) {
  const holdId = session.metadata?.hold_id?.trim()
  const tenantId = session.metadata?.tenant_id?.trim()
  const metadataAccountId =
    session.metadata?.stripe_connect_account_id?.trim()

  if (
    !holdId ||
    !tenantId ||
    !eventAccountId ||
    !metadataAccountId ||
    metadataAccountId !== eventAccountId
  ) {
    return null
  }

  return {
    holdId,
    tenantId,
    sessionId: session.id,
    stripeAccountId: eventAccountId,
  }
}

export function stripeId(reference: StripeReference) {
  if (typeof reference === 'string') return reference.trim() || null
  return reference?.id?.trim() || null
}

export type StripeRefundCharge = {
  id: string
  payment_intent: StripeReference
  amount_refunded: number
  currency: string
}

export function getRefundDetails(
  charge: StripeRefundCharge,
  eventAccountId: string | null,
) {
  const paymentIntentId = stripeId(charge.payment_intent)

  if (
    !eventAccountId ||
    !paymentIntentId ||
    !Number.isSafeInteger(charge.amount_refunded) ||
    charge.amount_refunded < 0 ||
    !/^[a-z]{3}$/.test(charge.currency)
  ) {
    return null
  }

  return {
    stripeAccountId: eventAccountId,
    chargeId: charge.id,
    paymentIntentId,
    amountRefunded: charge.amount_refunded,
    currency: charge.currency,
  }
}

export type StripeDisputeLike = {
  id: string
  charge: StripeReference
  payment_intent: StripeReference
  status: string
}

export function getDisputeDetails(
  dispute: StripeDisputeLike,
  eventAccountId: string | null,
) {
  const paymentIntentId = stripeId(dispute.payment_intent)
  if (!eventAccountId || !paymentIntentId) return null

  return {
    stripeAccountId: eventAccountId,
    chargeId: stripeId(dispute.charge),
    disputeId: dispute.id,
    paymentIntentId,
    status: dispute.status,
  }
}
