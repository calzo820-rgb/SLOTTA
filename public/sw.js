self.addEventListener('push', event => {
  console.log('SW PUSH ricevuta')
let data = {
  title: 'Nuova prenotazione',
  body: 'Hai ricevuto una nuova richiesta di prenotazione.',
  url: '/admin/service-bookings',
  icon: '/notification-icon.png',
  badge: '/notification-badge.png',
  badgeCount: 1,
  tag: 'slotta-new-booking-default',
}
  try {
    if (event.data) {
      data = event.data.json()
    }
  } catch {}

  event.waitUntil(
    (async () => {
      // La pagina aggiorna il badge nel contesto Window, dove Android/Chrome
      // espone in modo affidabile setAppBadge. Il service worker inoltra quindi
      // il conteggio a tutte le pagine Slotta già aperte.
      const badgeCount = Number(data.badgeCount || 0)
      const windowClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of windowClients) {
        client.postMessage({ type: 'slotta-badge-count', count: badgeCount })
      }

      await self.registration.showNotification(data.title || 'Slotta', {
  body: data.body || '',
  icon: data.icon || '/notification-icon.png',
  badge: data.badge || '/notification-badge.png',
  tag: data.tag || 'slotta-new-booking-default',
  renotify: true,
  data: {
    url: data.url || '/admin/service-bookings',
  },
})
    })(),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const url = event.notification.data?.url || '/admin/service-bookings'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    }),
  )
})
// sw-version: 2026-09-09-03
