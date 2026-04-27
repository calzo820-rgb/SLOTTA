import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PrenotaOra',
  description: 'Gestionale prenotazioni per saloni e pizzerie',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}

