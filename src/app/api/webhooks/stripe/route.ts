import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resend } from '@/lib/resendClient'
import { sendPushNotificationsToTenant } from '@/lib/sendPushNotifications'

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
    console.warn('Account Stripe Connect non coerente nel webhook completed:', {
      metadataStripeAccountId,
      eventStripeAccountId,
      sessionId: session.id,
    })

    return NextResponse.json({ received: true })
  }

  if (!holdId || !tenantId) {
        console.warn('Webhook Stripe senza hold_id o tenant_id:', {
          holdId,
          tenantId,
          sessionId: session.id,
        })

        return NextResponse.json({ received: true })
      }

      const { data: hold, error: holdErr } = await supabaseAdmin
        .from('service_booking_holds')
        .select(
          `
          id,
          tenant_id,
          service_id,
          staff_id,
          customer_name,
          customer_email,
          customer_phone,
          note,
          booking_date,
          booking_time,
          status,
          expires_at,
          stripe_session_id
        `,
        )
        .eq('id', holdId)
        .eq('tenant_id', tenantId)
        .single()

      if (holdErr || !hold) {
        throw holdErr || new Error('Hold prenotazione non trovato')
      }
      if (metadataStripeAccountId) {
        const { data: tenantConnect, error: tenantConnectErr } = await supabaseAdmin
          .from('tenants')
          .select('stripe_connect_account_id')
          .eq('id', tenantId)
          .maybeSingle()

        if (tenantConnectErr) {
          throw tenantConnectErr
        }

        if (
          tenantConnect?.stripe_connect_account_id &&
          tenantConnect.stripe_connect_account_id !== metadataStripeAccountId
        ) {
          console.warn('Tenant e Stripe account non coerenti nel webhook completed:', {
            tenantId,
            tenantStripeAccountId: tenantConnect.stripe_connect_account_id,
            metadataStripeAccountId,
            sessionId: session.id,
          })

          return NextResponse.json({ received: true })
        }
      }
      /**
       * Idempotenza:
       * Stripe può mandare lo stesso webhook più di una volta.
       * Se l'hold è già paid, non creiamo doppioni.
       */
      if (hold.status === 'paid') {
        return NextResponse.json({ received: true })
      }

      if (hold.status !== 'pending') {
        console.warn('Hold non più pending durante webhook completed:', {
          holdId,
          holdStatus: hold.status,
          sessionId: session.id,
        })

        return NextResponse.json({ received: true })
      }
/**
 * Idempotenza extra:
 * se esiste già una prenotazione con questo stripe_session_id,
 * non creiamo doppioni.
 */
const { data: existingBooking, error: existingBookingErr } = await supabaseAdmin
  .from('service_bookings')
  .select('id')
  .eq('stripe_session_id', session.id)
  .maybeSingle()

if (existingBookingErr) {
  throw existingBookingErr
}

if (existingBooking) {
  await supabaseAdmin
    .from('service_booking_holds')
    .update({
      status: 'paid',
      stripe_session_id: session.id,
    })
    .eq('id', hold.id)
    .eq('tenant_id', tenantId)

  return NextResponse.json({ received: true })
}
      /**
       * Crea la prenotazione vera.
       * Questa è la prima volta in cui il gestore la vedrà.
       */
      const { data: insertedBooking, error: insertErr } = await supabaseAdmin
        .from('service_bookings')
        .insert({
          tenant_id: hold.tenant_id,
          service_id: hold.service_id,
          staff_id: hold.staff_id,

          customer_name: hold.customer_name,
          customer_email: hold.customer_email,
          customer_phone: hold.customer_phone,
          note: hold.note,

          booking_date: hold.booking_date,
          booking_time: hold.booking_time,

          status: 'confirmed',
          payment_status: 'paid',
          stripe_session_id: session.id,
          checkout_pending: false,
        })
        .select('id')
        .single()

      if (insertErr) {
        throw insertErr
      }

      const { error: updateHoldErr } = await supabaseAdmin
        .from('service_booking_holds')
        .update({
          status: 'paid',
          stripe_session_id: session.id,
        })
        .eq('id', hold.id)
        .eq('tenant_id', tenantId)

      if (updateHoldErr) {
        throw updateHoldErr
      }

      /**
       * Recupero dati attività e servizio per email/notifiche
       */
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('name, contact_email')
        .eq('id', tenantId)
        .single()

      const { data: service } = await supabaseAdmin
        .from('services')
        .select('name, duration_minutes, price_cents')
        .eq('id', hold.service_id)
        .single()

      const businessName = tenant?.name || 'il salone'
      const serviceName = service?.name || 'Servizio'
      const price =
        typeof service?.price_cents === 'number'
          ? `€ ${(service.price_cents / 100).toFixed(2)}`
          : '—'

      const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

      /**
       * Email cliente
       */
      if (hold.customer_email) {
        try {
          await resend.emails.send({
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
          await resend.emails.send({
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
        const { count: pendingCount } = await supabaseAdmin
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
        const { error } = await supabaseAdmin
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