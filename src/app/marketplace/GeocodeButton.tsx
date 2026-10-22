'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GeocodeButton({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function findPosition() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/marketplace/internal/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        setMessage(data.error || 'Non è stato possibile trovare la posizione.')
        return
      }
      setMessage('Posizione trovata.')
      router.refresh()
    } catch {
      setMessage('Errore di connessione. Riprova tra poco.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={findPosition}
        disabled={busy}
        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#168B8A] px-4 text-sm font-semibold text-[#126E6D] transition hover:bg-[#168B8A]/5 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? 'Ricerca…' : 'Trova posizione'}
      </button>
      {message ? <p role="status" className="mt-1 text-xs text-slate-600">{message}</p> : null}
    </div>
  )
}
