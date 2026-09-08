import { NextResponse } from 'next/server'
import { enforceDistributedRateLimit, readJsonBody } from '@/lib/apiGuard'
import { logApiEvent, observeApiRoute } from '@/lib/apiObservability'
import { sendPushNotificationsToTenant } from '@/lib/sendPushNotifications'
import { loadManagedBooking } from '@/lib/serverBookingManagement'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { sendTransactionalEmail } from '@/lib/transactionalEmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function escapeHtml(value: string) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function handlePost(req: Request) {
  try {
    const limited = await enforceDistributedRateLimit(
      req,
      'customer-booking-cancel',
      10,
      60_000,
    )
    if (limited) return limited

    const body = await readJsonBody(req, 4_096)
    if (!body) {
      return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
    }

    const slug = String(body.slug || '')
    const token = String(body.token || '')
    const managed = await loadManagedBooking(slug, token)

    if (!managed) {
      return NextResponse.json(
        { error_code: 'INVALID_LINK', error: 'Link non valido o scaduto.' },
        { status: 404 },
      )
    }

    if (managed.cancellationState === 'cancelled') {
      return NextResponse.json({ ok: true, already_cancelled: true })
    }

    if (!managed.canCancel) {
      const error =
        managed.cancellationState === 'paid'
          ? 'La prenotazione è già pagata. Contatta l’attività per annullamento e rimborso.'
          : managed.cancellationState === 'too_late'
            ? `Il termine di ${managed.noticeHours} ore per annullare online è scaduto.`
            : 'Questa prenotazione non può più essere annullata online.'

      return NextResponse.json(
        { error_code: managed.cancellationState.toUpperCase(), error },
        { status: 409 },
      )
    }

    const cancelledAt = new Date().toISOString()
    const { data: cancelled, error: cancelError } = await getSupabaseAdmin()
      .from('service_bookings')
      .update({
        status: 'cancelled',
        customer_cancelled_at: cancelledAt,
        manager_seen_at: null,
      })
      .eq('id', managed.booking.id)
      .eq('tenant_id', managed.tenant.id)
      .eq('payment_status', 'unpaid')
      .in('status', ['pending', 'confirmed'])
      .select('id')
      .maybeSingle()

    if (cancelError) throw cancelError
    if (!cancelled) {
      return NextResponse.json(
        {
          error_code: 'BOOKING_CHANGED',
          error: 'La prenotazione è stata aggiornata. Ricarica la pagina.',
        },
        { status: 409 },
      )
    }

    const businessName = managed.tenant.name || 'l’attività'
    const serviceName = managed.service?.name || 'Servizio'
    const date = managed.booking.booking_date
    const time = String(managed.booking.booking_time).slice(0, 5)
    const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

    if (managed.booking.customer_email) {
      try {
        await sendTransactionalEmail(
          {
            from,
            to: managed.booking.customer_email,
            subject: `Prenotazione annullata - ${businessName}`,
            html: `
              <div style="font-family: Arial, sans-serif; color: #0F1D2D; line-height: 1.5; max-width: 560px; margin: 0 auto;">
                <h2>Prenotazione annullata</h2>
                <p>Ciao ${escapeHtml(managed.booking.customer_name || '')}, la tua prenotazione è stata annullata correttamente.</p>
                <div style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 16px; background: #f8fafc;">
                  <p><strong>Attività:</strong> ${escapeHtml(businessName)}</p>
                  <p><strong>Servizio:</strong> ${escapeHtml(serviceName)}</p>
                  <p><strong>Data:</strong> ${escapeHtml(date)}</p>
                  <p><strong>Ora:</strong> ${escapeHtml(time)}</p>
                </div>
              </div>
            `,
          },
          `customer-self-cancelled-${managed.booking.id}`,
        )
      } catch {
        logApiEvent('customer_cancellation_email_failed', 'error')
      }
    }

    if (managed.tenant.contact_email) {
      try {
        await sendTransactionalEmail(
          {
            from,
            to: managed.tenant.contact_email,
            subject: `Prenotazione annullata dal cliente - ${businessName}`,
            html: `
              <div style="font-family: Arial, sans-serif; color: #0F1D2D; line-height: 1.5; max-width: 560px; margin: 0 auto;">
                <h2>Il cliente ha annullato una prenotazione</h2>
                <p><strong>Cliente:</strong> ${escapeHtml(managed.booking.customer_name || '')}</p>
                <p><strong>Servizio:</strong> ${escapeHtml(serviceName)}</p>
                <p><strong>Data:</strong> ${escapeHtml(date)}</p>
                <p><strong>Ora:</strong> ${escapeHtml(time)}</p>
                <p>Lo slot è nuovamente disponibile.</p>
              </div>
            `,
          },
          `owner-customer-self-cancelled-${managed.booking.id}`,
        )
      } catch {
        logApiEvent('owner_cancellation_email_failed', 'error')
      }
    }

    try {
      const { count: pendingCount } = await getSupabaseAdmin()
        .from('service_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', managed.tenant.id)
        .eq('status', 'pending')

      await sendPushNotificationsToTenant(managed.tenant.id, {
        title: 'Prenotazione annullata dal cliente',
        body: `${managed.booking.customer_name || 'Un cliente'} ha liberato l’appuntamento del ${date} alle ${time}.`,
        url: '/admin/service-bookings',
        badgeCount: pendingCount ?? 0,
      })
    } catch {
      logApiEvent('customer_cancellation_push_failed', 'error')
    }

    logApiEvent('customer_booking_cancelled', 'info')
    return NextResponse.json({ ok: true })
  } catch {
    logApiEvent('customer_booking_cancellation_failed', 'error')
    return NextResponse.json(
      { error: 'Errore temporaneo durante l’annullamento.' },
      { status: 500 },
    )
  }
}

export const POST = observeApiRoute(
  '/api/public/manage-booking/cancel',
  handlePost,
)
