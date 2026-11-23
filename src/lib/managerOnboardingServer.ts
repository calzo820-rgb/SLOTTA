import { redirect } from 'next/navigation'
import type { MyMembership } from '@/lib/authz'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getManagerSetupSteps, type SetupHours, type SetupService, type SetupStaff, type SetupStaffHours } from '@/lib/managerOnboarding'

export type ManagerSetupSnapshot = {
  completedAt: string | null
  steps: ReturnType<typeof getManagerSetupSteps>
  services: Array<{ id: string; duration_minutes: number | null }>
  timezone: string
}

const CONFIGURATION_PATHS = new Set([
  '/admin/setup',
  '/admin/hours',
  '/admin/staff',
  '/admin/services',
])

export async function isManagerSetupPending(tenantId: string): Promise<boolean> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('tenants')
      .select('setup_completed_at')
      .eq('id', tenantId)
      .maybeSingle()

    // Fail open on infrastructure/schema errors so an onboarding problem
    // cannot lock an existing manager out of the dashboard.
    if (error || !data) return false
    return !data.setup_completed_at
  } catch {
    return false
  }
}

export async function requireManagerSetupOrRedirect(
  membership: MyMembership,
  requestedPath: string,
) {
  if (
    membership.role !== 'owner' ||
    CONFIGURATION_PATHS.has(requestedPath) ||
    !(await isManagerSetupPending(membership.tenant_id))
  ) {
    return
  }
  redirect('/admin/setup')
}

export async function loadManagerSetupSnapshot(
  tenantId: string,
): Promise<ManagerSetupSnapshot> {
  const db = getSupabaseAdmin()
  const [tenantResult, hoursResult, staffResult, staffHoursResult, servicesResult, settingsResult] =
    await Promise.all([
      db.from('tenants').select('setup_completed_at').eq('id', tenantId).maybeSingle(),
      db
        .from('tenant_hours')
        .select('dow, is_closed, open_time_am, close_time_am, pm_enabled, has_split, open_time_pm, close_time_pm, open_time, close_time')
        .eq('tenant_id', tenantId),
      db
        .from('staff_members')
        .select('id, is_active, position')
        .eq('tenant_id', tenantId),
      db
        .from('staff_hours')
        .select('staff_id, dow, is_closed, open_time_am, close_time_am, pm_enabled, open_time_pm, close_time_pm')
        .eq('tenant_id', tenantId),
      db
        .from('services')
        .select('id, name, duration_minutes, price_cents, is_active')
        .eq('tenant_id', tenantId),
      db
        .from('tenant_settings')
        .select('timezone')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
    ])

  const error = [
    tenantResult.error,
    hoursResult.error,
    staffResult.error,
    staffHoursResult.error,
    servicesResult.error,
    settingsResult.error,
  ].find(Boolean)
  if (error) throw error

  const hours = (hoursResult.data || []) as SetupHours[]
  const staff = (staffResult.data || []) as SetupStaff[]
  const staffHours = (staffHoursResult.data || []) as SetupStaffHours[]
  const services = (servicesResult.data || []) as SetupService[]

  return {
    completedAt: tenantResult.data?.setup_completed_at || null,
    steps: getManagerSetupSteps({ tenantHours: hours, staff, staffHours, services }),
    services: services
      .filter(service => service.is_active === true)
      .map(service => ({ id: service.id, duration_minutes: service.duration_minutes })),
    timezone: settingsResult.data?.timezone || 'Europe/Rome',
  }
}

export async function completeManagerSetup(tenantId: string) {
  const snapshot = await loadManagerSetupSnapshot(tenantId)
  if (snapshot.steps.some(step => !step.complete)) {
    return { ok: false as const, snapshot }
  }

  const db = getSupabaseAdmin()
  const { error } = await db
    .from('tenants')
    .update({ setup_completed_at: new Date().toISOString() })
    .eq('id', tenantId)
    .is('setup_completed_at', null)
  if (error) throw error

  const refreshed = await loadManagerSetupSnapshot(tenantId)
  if (!refreshed.completedAt) {
    throw new Error('Impossibile registrare il completamento iniziale.')
  }

  return { ok: true as const, snapshot: refreshed }
}
