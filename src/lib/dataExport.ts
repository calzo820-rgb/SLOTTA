export const TENANT_EXPORT_TABLES = [
  'tenants',
  'tenant_settings',
  'services',
  'staff_members',
  'tenant_hours',
  'staff_hours',
  'closures',
  'tenant_users',
  'service_bookings',
] as const

export type TenantExportTable = (typeof TENANT_EXPORT_TABLES)[number]

export function safeExportFilenamePart(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'attivita'
}
