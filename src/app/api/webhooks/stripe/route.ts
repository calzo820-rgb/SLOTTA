import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getResend } from '@/lib/resendClient'
import { sendPushNotificationsToTenant } from '@/lib/sendPushNotifications'
import {
  getPaidCheckoutDetails,
  isStripeFinalizationError,
} from '@/lib/stripeCheckoutValidation'

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

export async function POST(req: Request) {
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
  } catch (err: unknown) {
    // Log the raw error for debugging
    console.error('Errore verifica webhook Stripe:', err)
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 })
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
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const payment = getPaidCheckoutDetails(session, event.account || null)

      if (!payment) {
        console.warn('Checkout Stripe non idonea alla finalizzazione:', {
          eventId: event.id,
          sessionId: session.id,
          paymentStatus: session.payment_status,
        })
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

      const insertedBooking = { id: finalizationResult.booking_id }

      /**
       * Recupero dati attività e servizio per email/notifiche
       */
      const { data: tenant } = await getSupabaseAdmin()
        .from('tenants')
        .select('name, contact_email')
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

      /**
       * Email cliente
       */
      if (hold.customer_email) {
        try {
          await getResend().emails.send({
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

                <p style="margin-top: 16px;">
                  Per modifiche o necessità, contatta direttamente l’attività.
                </p>
              </div>
            `,
          })
        } catch (emailErr) {
          console.error('Errore invio email cliente pagamento Stripe:', emailErr)
        }
      }

      /**
       * Email gestore
       */
      if (tenant?.contact_email) {
        try {
          await getResend().emails.send({
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
          })
        } catch (emailErr) {
          console.error('Errore invio email gestore pagamento Stripe:', emailErr)
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
      } catch (pushErr) {
        console.error('Errore invio push prenotazione pagata:', pushErr)
      }

      console.log('Prenotazione creata da hold Stripe:', {
        holdId: hold.id,
        bookingId: insertedBooking?.id,
        sessionId: session.id,
      })
    }

    /**
     * SESSIONE STRIPE SCADUTA
     *
     * Se il cliente non paga entro il tempo limite,
     * l'hold diventa expired e lo slot torna libero.
     */
if (event.type === 'checkout.session.expired') {
  const session = event.data.object as Stripe.Checkout.Session

  const holdId = session.metadata?.hold_id
  const tenantId = session.metadata?.tenant_id
  const metadataStripeAccountId =
    session.metadata?.stripe_connect_account_id || null
  const eventStripeAccountId = event.account || null

  if (
    metadataStripeAccountId &&
    eventStripeAccountId &&
    metadataStripeAccountId !== eventStripeAccountId
  ) {
    console.warn('Account Stripe Connect non coerente nel webhook expired:', {
      metadataStripeAccountId,
      eventStripeAccountId,
      sessionId: session.id,
    })

    return NextResponse.json({ received: true })
  }

  if (holdId && tenantId) {
        const { error } = await getSupabaseAdmin()
          .from('service_booking_holds')
          .update({
            status: 'expired',
          })
          .eq('id', holdId)
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')

        if (error) {
          throw error
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    if (isStripeFinalizationError(err)) {
      console.warn('Webhook Stripe rifiutato dalla finalizzazione:', err)
      return NextResponse.json({ received: true })
    }
    // Log the raw error for debugging
    console.error('Errore gestione webhook Stripe:', err)
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
