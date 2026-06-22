import './globals.css'

export const metadata = {
  title: 'Slotta',
  description: 'Prenotazioni online semplici per attività e professionisti.',

  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport = {
  themeColor: '#0F1D2D',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <head>
  <link rel="icon" href="/icon-192.png" />
  <link rel="apple-touch-icon" href="/apple-icon.png" />
  <meta name="theme-color" content="#061B35" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Slotta" />
</head>

      <body>
        {children}
      </body>
    </html>
  )
}
