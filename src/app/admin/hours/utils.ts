export function toTime5(v: string) {
  if (!v) return '09:00'
  return v.slice(0, 5)
}

export function toTime8(v: string) {
  if (!v) return '09:00:00'
  return v.length === 5 ? `${v}:00` : v
}

export function timeToMinutes(t: string) {
  const [hh, mm] = String(t || '0:0').split(':')
  return (parseInt(hh || '0', 10) || 0) * 60 + (parseInt(mm || '0', 10) || 0)
}

export function minutesToTime(min: number) {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

export function errToString(e: unknown) {
  if (!e) return ''
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  if (typeof e !== 'object') return String(e)

  const obj = e as Record<string, unknown>

  const msg = typeof obj.message === 'string' ? obj.message : ''
  const code = typeof obj.code === 'string' ? obj.code : ''
  const details = typeof obj.details === 'string' ? obj.details : ''
  const hint = typeof obj.hint === 'string' ? obj.hint : ''

  const parts = [
    msg,
    code && `code=${code}`,
    details && `details=${details}`,
    hint && `hint=${hint}`,
  ].filter(Boolean)

  if (parts.length) return parts.join(' | ')

  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}