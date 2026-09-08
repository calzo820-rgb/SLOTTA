import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { sendPushNotificationsToTenant } from '@/lib/sendPushNotifications'
import { logApiEvent, observeApiRoute } from '@/lib/apiObservability'
import { sendTransactionalEmail } from '@/lib/transactionalEmail'
import {
  getPaidCheckoutDetails,
  isStripeFinalizationError,
} from '@/lib/stripeCheckoutValidation'
import {
  getCheckoutLifecycleDetails,
  getDisputeDetails,
  getRefundDetails,
} from '@/lib/stripeWebhookEvents'
import {
  bookingManagementExpiry,
  buildBookingManagementUrl,
  createBookingManagementToken,
  hashBookingManagementToken,
} from '@/lib/bookingManagement'

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
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json(
      { error: 'Configurazione Stripe mancante' },
      { status: 500 },
    )
  }

  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Stripe signature mancante' },
      { status: 400 },
    )
  }

  const stripe = new Stripe(stripeSecretKey)

  let event: Stripe.Event

  try {
    const rawBody = Buffer.from(await req.arrayBuffer())

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    )
  } catch {
    logApiEvent('stripe_webhook_signature_invalid')
    return new NextResponse('Webhook signature invalid', { status: 400 })
  }

  try {
    /**
     * PAGAMENTO COMPLETATO
     *
     * Nuovo flusso:
     * - Stripe non riceve più booking_id
     * - Stripe riceve hold_id
     * - Il webhook trasforma l'hold in prenotazione vera
     */
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as Stripe.Checkout.Session
      const payment = getPaidCheckoutDetails(session, event.account || null)

      if (!payment) {
        logApiEvent('stripe_checkout_not_finalizable')
        return NextResponse.json({ received: true })
      }

      const { data: finalization, error: finalizationError } =
        await getSupabaseAdmin()
          .rpc('finalize_stripe_booking', {
            p_hold_id: payment.holdId,
            p_tenant_id: payment.tenantId,
            p_stripe_session_id: payment.sessionId,
            p_stripe_payment_intent_id: payment.paymentIntentId,
            p_amount_total: payment.amountTotal,
            p_currency: payment.currency,
            p_stripe_connect_account_id: payment.stripeAccountId,
            p_event_id: event.id,
            p_event_type: event.type,
          })
          .single()

      if (finalizationError) throw finalizationError
      const finalizationResult = finalization as {
        booking_id: string
        was_created: boolean
      } | null

      if (!finalizationResult?.was_created) {
        return NextResponse.json({ received: true })
      }

      const holdId = payment.holdId
      const tenantId = payment.tenantId
      const { data: hold, error: holdErr } = await getSupabaseAdmin()
        .from('service_booking_holds')
        .select(
          `
          id,
          service_id,
          customer_name,
          customer_email,
          customer_phone,
          booking_date,
          booking_time
        `,
        )
        .eq('id', holdId)
        .eq('tenant_id', tenantId)
        .single()

      if (holdErr || !hold) {
        throw holdErr || new Error('Hold prenotazione non trovato')
      }

      /**
       * Recupero dati attività e servizio per email/notifiche
       */
      const { data: tenant } = await getSupabaseAdmin()
        .from('tenants')
        .select('name, slug, contact_email')
        .eq('id', tenantId)
        .single()

      const { data: service } = await getSupabaseAdmin()
        .from('services')
        .select('name')
        .eq('id', hold.service_id)
        .single()

      const businessName = tenant?.name || 'il salone'
      const serviceName = service?.name || 'Servizio'
      const price = `€ ${(payment.amountTotal / 100).toFixed(2)}`

      const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
      const managementToken = createBookingManagementToken()
      const managementExpiresAt = bookingManagementExpiry(hold.booking_date)
      const { error: managementTokenError } = await getSupabaseAdmin()
        .from('service_bookings')
        .update({
          management_token_hash: hashBookingManagementToken(managementToken),
          management_token_expires_at: managementExpiresAt.toISOString(),
        })
        .eq('id', finalizationResult.booking_id)
        .eq('tenant_id', tenantId)

      if (managementTokenError) throw managementTokenError

      const managementUrl = buildBookingManagementUrl(
        new URL(req.url).origin,
        tenant?.slug || '',
        managementToken,
      )

      /**
       * Email cliente
       */
      if (hold.customer_email) {
        try {
          await sendTransactionalEmail({
            from,
            to: hold.customer_email,
            subject: `Prenotazione confermata - ${businessName}`,
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0F1D2D;">
                <h2>Prenotazione confermata</h2>

                <p>
                  Ciao ${escapeHtml(hold.customer_name || '')},<br />
                  il pagamento è andato a buon fine e la tua prenotazione è confermata.
                </p>

                <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f8fafc;">
                  <p><strong>Attività:</strong> ${escapeHtml(businessName)}</p>
                  <p><strong>Servizio:</strong> ${escapeHtml(serviceName)}</p>
                  <p><strong>Data:</strong> ${escapeHtml(hold.booking_date)}</p>
                  <p><strong>Ora:</strong> ${escapeHtml(String(hold.booking_time).slice(0, 5))}</p>
                  <p><strong>Prezzo:</strong> ${escapeHtml(price)}</p>
                  <p><strong>Pagamento:</strong> online completato</p>
                </div>

                <p style="margin-top: 18px;">
                  <a href="${escapeHtml(managementUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 14px; background: #0F1D2D; color: #ffffff; text-decoration: none; font-weight: bold;">
                    Gestisci prenotazione
                  </a>
                </p>
                <p style="margin-top: 16px; color: #64748b;">
                  Per annullamento e rimborso di una prenotazione già pagata, contatta direttamente l’attività.
                </p>
              </div>
            `,
          }, `stripe-customer-${event.id}`)
        } catch {
          logApiEvent('stripe_customer_email_failed', 'error')
        }
      }

      /**
       * Email gestore
       */
      if (tenant?.contact_email) {
        try {
          await sendTransactionalEmail({
            from,
            to: tenant.contact_email,
            subject: `Nuova prenotazione pagata - ${businessName}`,
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0F1D2D;">
                <h2>Nuova prenotazione pagata</h2>

                <p>
                  È arrivata una nuova prenotazione online con pagamento completato.
                </p>

                <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f8fafc;">
                  <p><strong>Cliente:</strong> ${escapeHtml(hold.customer_name || '')}</p>
                  <p><strong>Telefono:</strong> ${escapeHtml(hold.customer_phone || 'Non indicato')}</p>
                  <p><strong>Email:</strong> ${escapeHtml(hold.customer_email || 'Non indicata')}</p>
                  <p><strong>Servizio:</strong> ${escapeHtml(serviceName)}</p>
                  <p><strong>Data:</strong> ${escapeHtml(hold.booking_date)}</p>
                  <p><strong>Ora:</strong> ${escapeHtml(String(hold.booking_time).slice(0, 5))}</p>
                  <p><strong>Prezzo:</strong> ${escapeHtml(price)}</p>
                  <p><strong>Pagamento:</strong> online completato</p>
                </div>

                <p style="margin-top: 16px;">
                  La prenotazione è stata confermata automaticamente perché il pagamento è andato a buon fine.
                </p>
              </div>
            `,
          }, `stripe-owner-${event.id}`)
        } catch {
          logApiEvent('stripe_owner_email_failed', 'error')
        }
      }

      /**
       * Push gestore
       */
      try {
        const { count: pendingCount } = await getSupabaseAdmin()
          .from('service_bookings')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')

        await sendPushNotificationsToTenant(tenantId, {
          title: 'Nuova prenotazione pagata',
          body: `${hold.customer_name} ha pagato e confermato un appuntamento.`,
          url: '/admin/service-bookings',
          badgeCount: pendingCount ?? 0,
        })
      } catch {
        logApiEvent('stripe_booking_push_failed', 'error')
      }

      logApiEvent('stripe_booking_finalized', 'info')
    }

    /**
     * SESSIONE STRIPE SCADUTA
     *
     * Se il cliente non paga entro il tempo limite,
     * l'hold diventa expired e lo slot torna libero.
     */
    if (
      event.type === 'checkout.session.expired' ||
      event.type === 'checkout.session.async_payment_failed'
    ) {
      const session = event.data.object as Stripe.Checkout.Session
      const details = getCheckoutLifecycleDetails(
        session,
        event.account || null,
      )

      if (!details) {
        logApiEvent('stripe_checkout_event_incoherent')
        return NextResponse.json({ received: true })
      }

      const { error } = await getSupabaseAdmin().rpc(
        'process_stripe_booking_event',
        {
          p_event_id: event.id,
          p_event_type: event.type,
          p_stripe_account_id: details.stripeAccountId,
          p_object_id: session.id,
          p_tenant_id: details.tenantId,
          p_hold_id: details.holdId,
          p_stripe_session_id: details.sessionId,
          p_payment_intent_id: null,
          p_charge_id: null,
          p_dispute_id: null,
          p_dispute_status: null,
          p_amount_refunded: null,
          p_currency: null,
        },
      )

      if (error) throw error
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge
      const details = getRefundDetails(charge, event.account || null)

      if (!details) {
        logApiEvent('stripe_refund_event_incoherent')
        return NextResponse.json({ received: true })
      }

      const { error } = await getSupabaseAdmin().rpc(
        'process_stripe_booking_event',
        {
          p_event_id: event.id,
          p_event_type: event.type,
          p_stripe_account_id: details.stripeAccountId,
          p_object_id: charge.id,
          p_tenant_id: null,
          p_hold_id: null,
          p_stripe_session_id: null,
          p_payment_intent_id: details.paymentIntentId,
          p_charge_id: details.chargeId,
          p_dispute_id: null,
          p_dispute_status: null,
          p_amount_refunded: details.amountRefunded,
          p_currency: details.currency,
        },
      )

      if (error) throw error
    }

    if (
      event.type === 'charge.dispute.created' ||
      event.type === 'charge.dispute.closed'
    ) {
      const dispute = event.data.object as Stripe.Dispute
      const details = getDisputeDetails(dispute, event.account || null)

      if (!details) {
        logApiEvent('stripe_dispute_event_incoherent')
        return NextResponse.json({ received: true })
      }

      const { error } = await getSupabaseAdmin().rpc(
        'process_stripe_booking_event',
        {
          p_event_id: event.id,
          p_event_type: event.type,
          p_stripe_account_id: details.stripeAccountId,
          p_object_id: dispute.id,
          p_tenant_id: null,
          p_hold_id: null,
          p_stripe_session_id: null,
          p_payment_intent_id: details.paymentIntentId,
          p_charge_id: details.chargeId,
          p_dispute_id: details.disputeId,
          p_dispute_status: details.status,
          p_amount_refunded: null,
          p_currency: null,
        },
      )

      if (error) throw error
    }

    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account
      const eventAccountId = event.account || account.id

      if (eventAccountId !== account.id) {
        logApiEvent('stripe_connect_event_incoherent')
        return NextResponse.json({ received: true })
      }

      const { error } = await getSupabaseAdmin().rpc(
        'process_stripe_connect_event',
        {
          p_event_id: event.id,
          p_stripe_account_id: account.id,
          p_details_submitted: account.details_submitted ?? false,
          p_charges_enabled: account.charges_enabled ?? false,
          p_payouts_enabled: account.payouts_enabled ?? false,
          p_disabled_reason: account.requirements?.disabled_reason ?? null,
          p_requirements: account.requirements ?? null,
        },
      )

      if (error) throw error
    }

    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    if (isStripeFinalizationError(err)) {
      logApiEvent('stripe_webhook_finalization_rejected')
      return NextResponse.json({ received: true })
    }
    logApiEvent('stripe_webhook_processing_failed', 'error')
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Errore gestione webhook Stripe',
      },
      { status: 500 },
    )
  }
}

export const POST = observeApiRoute('/api/webhooks/stripe', handlePost)
