import { NextResponse } from 'next/server'
import { getMyMembership } from '@/lib/authz'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getSetupSteps } from '@/lib/setupChecklist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const membership = await getMyMembership()

    if (!membership) {
      return NextResponse.json(
        { error: 'Sessione non valida.' },
        { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
      )
    }
    if (membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Operazione riservata al titolare.' },
        { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
      )
    }

    const admin = getSupabaseAdmin()
    const tenantId = membership.tenant_id
    const [tenantResult, hoursResult, staffResult, staffHoursResult, servicesResult, settingsResult] =
      await Promise.all([
        admin
          .from('tenants')
          .select('name, slug, address, contact_email, phone, whatsapp_phone')
          .eq('id', tenantId)
          .maybeSingle(),
        admin
          .from('tenant_hours')
          .select(
            'dow, is_closed, open_time_am, close_time_am, pm_enabled, has_split, open_time_pm, close_time_pm, open_time, close_time',
          )
          .eq('tenant_id', tenantId),
        admin
          .from('staff_members')
          .select('id, is_active, position')
          .eq('tenant_id', tenantId),
        admin
          .from('staff_hours')
          .select(
            'staff_id, dow, is_closed, open_time_am, close_time_am, pm_enabled, open_time_pm, close_time_pm',
          )
          .eq('tenant_id', tenantId),
        admin
          .from('services')
          .select('id, name, duration_minutes, price_cents, is_active')
          .eq('tenant_id', tenantId),
        admin
          .from('tenant_settings')
          .select('timezone')
          .eq('tenant_id', tenantId)
          .maybeSingle(),
      ])

    const firstError = [
      tenantResult.error,
      hoursResult.error,
      staffResult.error,
      staffHoursResult.error,
      servicesResult.error,
      settingsResult.error,
    ].find(Boolean)
    if (firstError) throw firstError

    const steps = getSetupSteps({
      tenant: tenantResult.data,
      tenantHours: hoursResult.data || [],
      staff: staffResult.data || [],
      staffHours: staffHoursResult.data || [],
      services: servicesResult.data || [],
    })

    return NextResponse.json(
      {
        steps,
        services: (servicesResult.data || [])
          .filter(service => service.is_active !== false)
          .map(service => ({
            id: service.id,
            duration_minutes: service.duration_minutes,
          })),
        timezone: settingsResult.data?.timezone || 'Europe/Rome',
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    )
  } catch (error) {
    console.error('setup progress load failed', error)
    return NextResponse.json(
      { error: 'Impossibile verificare la configurazione.' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
}
