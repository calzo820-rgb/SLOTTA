'use client'

import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const cleanEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Inserisci una email valida.')
      setLoading(false)
      return
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      cleanEmail,
      { redirectTo: `${window.location.origin}/update-password` },
    )

    if (resetError) {
      console.error('password reset request failed', resetError)
      setError('Non è stato possibile inviare la richiesta. Riprova tra poco.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2F4F7] p-6 text-[#0F1D2D]">
      <div className="grid w-full max-w-md gap-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">Slotta</p>
          <h1 className="mt-1 text-2xl font-black">Recupera la password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Inserisci l’email del gestore. Se è associata a un account riceverai un link sicuro.
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" role="status">
            Controlla la posta e segui il link ricevuto. Verifica anche la cartella spam.
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</div> : null}
            <label className="grid gap-1">
              <span className="text-sm font-bold">Email gestore</span>
              <input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10" />
            </label>
            <button type="submit" disabled={loading} className="rounded-2xl bg-[#FFC145] px-4 py-3 text-sm font-black disabled:opacity-60">
              {loading ? 'Invio…' : 'Invia link di recupero'}
            </button>
          </form>
        )}

        <Link href="/login" className="text-center text-sm font-bold text-[#1FA7A6] hover:underline">Torna al login</Link>
      </div>
    </main>
  )
}
