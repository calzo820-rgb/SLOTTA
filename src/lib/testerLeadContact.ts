export const TESTER_CONTACT_METHODS = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'call', label: 'Chiamata' },
] as const

export type TesterContactMethod = (typeof TESTER_CONTACT_METHODS)[number]['value']

const allowedMethods = new Set<string>(TESTER_CONTACT_METHODS.map(method => method.value))
const methodLabels = new Map<string, string>(TESTER_CONTACT_METHODS.map(method => [method.value, method.label]))

export type TesterLeadContactValidation =
  | { ok: true; contactMethods: TesterContactMethod[]; email: string | null; phone: string | null }
  | { ok: false; error: string }

export function validateTesterLeadContact(
  rawMethods: unknown,
  rawEmail: unknown,
  rawPhone: unknown,
): TesterLeadContactValidation {
  const selected = Array.isArray(rawMethods) ? rawMethods : []
  if (selected.some(method => typeof method !== 'string' || !allowedMethods.has(method))) {
    return { ok: false, error: 'Seleziona modalità di ricontatto valide.' }
  }
  const contactMethods = TESTER_CONTACT_METHODS
    .map(method => method.value)
    .filter(method => selected.includes(method))
  if (contactMethods.length === 0) {
    return { ok: false, error: 'Seleziona almeno una modalità di ricontatto.' }
  }

  const email = String(rawEmail ?? '').trim()
  if (contactMethods.includes('email') && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { ok: false, error: 'Inserisci un indirizzo email valido.' }
  }

  const needsPhone = contactMethods.some(method => method !== 'email')
  const phone = String(rawPhone ?? '').trim()
  if (needsPhone && phone.replace(/\D/g, '').length < 8) {
    return { ok: false, error: 'Inserisci un numero di telefono valido.' }
  }

  return {
    ok: true,
    contactMethods,
    email: contactMethods.includes('email') ? email : null,
    phone: needsPhone ? phone : null,
  }
}

export function testerContactMethodLabels(methods: readonly string[]): string[] {
  return methods.map(method => methodLabels.get(method) ?? method)
}
