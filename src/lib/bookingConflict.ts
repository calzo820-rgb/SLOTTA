export const STAFF_OVERLAP_ERROR_CODE = '23P01'
export const STAFF_OVERLAP_ERROR_MARKER = 'SLOTTA_STAFF_OVERLAP'

type DatabaseErrorLike = {
  code?: unknown
  message?: unknown
  details?: unknown
}

export function isStaffOverlapError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const candidate = error as DatabaseErrorLike
  const text = `${String(candidate.message || '')} ${String(candidate.details || '')}`

  return (
    candidate.code === STAFF_OVERLAP_ERROR_CODE ||
    text.includes(STAFF_OVERLAP_ERROR_MARKER)
  )
}

export function staffBusyResponseBody() {
  return {
    error_code: 'STAFF_BUSY',
    error: 'Operatore già occupato in questo orario.',
  }
}

