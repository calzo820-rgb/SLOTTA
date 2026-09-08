export const SLOTTA_TRIAL_DAYS = 14

export type BillingStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'paused'

export function normalizeBillingStatus(value: unknown): BillingStatus {
  const status = String(value || '').toLowerCase()
  if (['trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'paused'].includes(status)) {
    return status as BillingStatus
  }
  return 'incomplete'
}

export function billingStatusLabel(status: BillingStatus) {
  return ({
    trialing: 'Prova gratuita',
    active: 'Attivo',
    past_due: 'Pagamento da regolarizzare',
    canceled: 'Annullato',
    unpaid: 'Non pagato',
    incomplete: 'Da attivare',
    paused: 'In pausa',
  } as const)[status]
}

export function canUseBillingPortal(customerId: unknown) {
  return typeof customerId === 'string' && customerId.startsWith('cus_')
}

export function stripeReferenceId(value: unknown, prefix: string) {
  if (typeof value === 'string') return value.startsWith(prefix) ? value : null
  if (value && typeof value === 'object' && 'id' in value) {
    const id = String((value as { id?: unknown }).id || '')
    return id.startsWith(prefix) ? id : null
  }
  return null
}

export function subscriptionPeriodEnd(subscription: {
  items?: { data?: Array<{ current_period_end?: number }> }
}) {
  const timestamps = (subscription.items?.data || [])
    .map(item => Number(item.current_period_end || 0))
    .filter(value => Number.isFinite(value) && value > 0)
  return timestamps.length ? new Date(Math.max(...timestamps) * 1000).toISOString() : null
}
