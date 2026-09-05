import './globals.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.slotta.it'),
  title: {
    default: 'Slotta | Prenotazioni smart',
    template: '%s | Slotta',
  },
  description: 'Prenotazioni online semplici per attività e professionisti.',
  manifest: '/manifest.json',
  applicationName: 'Slotta',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: '/',
    siteName: 'Slotta',
    title: 'Slotta | Prenotazioni smart',
    description: 'Prenotazioni online semplici per attività e professionisti.',
    images: [{ url: '/landing-mockup.png', width: 1536, height: 1024, alt: 'Anteprima di Slotta' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Slotta | Prenotazioni smart',
    description: 'Prenotazioni online semplici per attività e professionisti.',
    images: ['/landing-mockup.png'],
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#0F1D2D',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body>
        {children}
      </body>
    </html>
  )
}
