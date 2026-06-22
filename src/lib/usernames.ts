export function normalizeUsername(u: string) {
  return u.trim().toLowerCase().replace(/\s+/g, '')
}

export function normalizeStaffCode(code: string) {
  return code.trim().replace(/\D/g, '')
}

export function usernameToEmail(u: string) {
  const user = normalizeUsername(u)
  return `${user}@slotta.local`
}

export function staffUsernameToEmail(username: string, staffCode: string) {
  const user = normalizeUsername(username)
  const code = normalizeStaffCode(staffCode)

  return `${user}.${code}@slotta.local`
}