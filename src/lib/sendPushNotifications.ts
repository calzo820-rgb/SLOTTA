import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type PushPayload = {
  title: string
  body: string
  url?: string
  badge?: string
  tag?: string
   badgeCount?: number
}

type PushSubscriptionRow = {
  id: string
  tenant_id: string
  endpoint: string
  p256dh: string
  auth: string
}

let webPushConfigured = false

function configureWebPush() {
  if (webPushConfigured) return true

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey || !privateKey) {
    console.warn('VAPID keys mancanti: notifiche push disattivate.')
    return false
  }

  webpush.setVapidDetails(
    'mailto:info@slotta.it',
    publicKey,
    privateKey,
  )

  webPushConfigured = true
  return true
}

export async function sendPushNotificationsToTenant(
  tenantId: string,
  payload: PushPayload,
) {
  const ready = configureWebPush()

  if (!ready) {
    return
  }

  const { data, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, tenant_id, endpoint, p256dh, auth')
    .eq('tenant_id', tenantId)

  if (error) {
    throw error
  }

  const subscriptions = (data || []) as PushSubscriptionRow[]

if (subscriptions.length === 0) {
  return
}

  const notificationPayload = JSON.stringify({
  title: payload.title,
  body: payload.body,
  url: payload.url || '/admin/service-bookings',
  badgeCount: payload.badgeCount ?? 1,
    badge: payload.badge || '/notification-badge.png',
tag: 'slotta-new-booking',
  })

  await Promise.allSettled(
    subscriptions.map(async sub => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notificationPayload,
        )
      } catch (err: unknown) {
        // Log the raw error; avoid typing the caught error as any
        console.error('Errore invio singola push:', err)
        // Some errors from webpush may include a statusCode field. Avoid casting to `any` by
        // narrowing to an object with an optional statusCode property. If the status code
        // indicates the subscription is gone (404 or 410) then remove it from the DB.
        const errorWithStatus = err as { statusCode?: number }
        const statusCode = errorWithStatus?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)
        }
      }
    }),
  )
}