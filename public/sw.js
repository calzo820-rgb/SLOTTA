self.addEventListener('push', event => {
  console.log('SW PUSH ricevuta')
let data = {
  title: 'Nuova prenotazione',
  body: 'Hai ricevuto una nuova richiesta di prenotazione.',
  url: '/admin/service-bookings',
  icon: '/notification-icon.png',
  badge: '/notification-badge.png',
  badgeCount: 1,
  tag: 'slotta-new-booking',
}
  try {
    if (event.data) {
      data = event.data.json()
    }
  } catch {}

  event.waitUntil(
    (async () => {
      // Aggiorna il numero rosso sull'icona dell'app, dove supportato
      try {
        const badgeCount = Number(data.badgeCount || 0)

        if ('setAppBadge' in self.navigator && badgeCount > 0) {
          await self.navigator.setAppBadge(badgeCount)
        }

        if ('clearAppBadge' in self.navigator && badgeCount === 0) {
          await self.navigator.clearAppBadge()
        }
      } catch {}

      await self.registration.showNotification(data.title || 'Slotta', {
  body: data.body || '',
  icon: data.icon || '/notification-icon.png',
  badge: data.badge || '/notification-badge.png',
  tag: data.tag || 'slotta-new-booking',
  renotify: false,
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
// sw-version: 2026-05-11-02