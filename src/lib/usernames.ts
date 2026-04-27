export function normalizeUsername(u: string) {
  return u.trim().toLowerCase().replace(/\s+/g, '')
}

export function usernameToEmail(u: string) {
  const user = normalizeUsername(u)
  return `${user}@prenotaora.local`
}