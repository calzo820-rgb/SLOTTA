export const ACCOUNT_DELETION_GRACE_DAYS = 30

export type AccountDeletionStatus = 'scheduled' | 'cancelled' | 'completed'

export function normalizeConfirmation(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('it-IT')
}

export function matchesTenantName(value: unknown, tenantName: unknown) {
  const confirmation = normalizeConfirmation(value)
  const expected = normalizeConfirmation(tenantName)
  return expected.length > 0 && confirmation === expected
}

export function canCancelDeletion(status: unknown, scheduledFor: unknown, now = Date.now()) {
  if (status !== 'scheduled' || typeof scheduledFor !== 'string') return false
  const scheduledAt = Date.parse(scheduledFor)
  return Number.isFinite(scheduledAt) && scheduledAt > now
}
