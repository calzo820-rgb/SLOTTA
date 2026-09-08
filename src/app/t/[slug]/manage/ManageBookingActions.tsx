'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function ManageBookingActions({
  slug,
  token,
}: {
  slug: string
  token: string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function cancelBooking() {
    if (!window.confirm('Vuoi annullare definitivamente questa prenotazione?')) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/public/manage-booking/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, token }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Impossibile annullare la prenotazione.')
      }

      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Impossibile annullare la prenotazione.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-3">
      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={cancelBooking}
        disabled={saving}
        className="rounded-2xl border border-red-200 bg-white px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Annullamento…' : 'Annulla prenotazione'}
      </button>
    </div>
  )
}
