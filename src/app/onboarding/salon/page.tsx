'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'



export default function OnboardingSalonPage() {
  const router = useRouter()

  const [salonName, setSalonName] = useState('')
  const [publicEmail, setPublicEmail] = useState('') // email “vera” del salone (contatto)
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

async function onSubmit(e: React.FormEvent) {
  e.preventDefault()
  setErr(null)

  if (!salonName.trim()) return setErr('Inserisci il nome del salone.')
  const authEmail = publicEmail.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)) {
    return setErr('Inserisci una email valida.')
  }
  if (password.length < 8) return setErr('Password troppo corta (min 8 caratteri).')

  setLoading(true)
  try {
    // L'account gestore usa una email reale, necessaria anche per il recupero password.
    const { error: signUpErr } = await supabase.auth.signUp({
      email: authEmail,
      password,
    })
    if (signUpErr) throw signUpErr

    // 2) SIGN IN (serve per ottenere sessione immediata in locale)
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    })
    if (signInErr) throw signInErr

    // 2.1) token
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
    if (sessionErr) throw sessionErr

    const token = sessionData?.session?.access_token
    if (!token) throw new Error('Sessione non valida (token mancante).')

    // 3) CREA tenant + owner in tenant_users (server-side)
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        businessName: salonName.trim(),
        timezone: 'Europe/Rome',
        contactEmail: authEmail,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || 'Errore creazione salone.')
    }

    setLoading(false)

    // 4) Vai all’admin
    router.replace('/admin')
    router.refresh()
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'Errore in registrazione.'
    setErr(message)
    setLoading(false)
  }
}

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg bg-white border rounded-2xl shadow-sm p-6 grid gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold">Crea il tuo salone</h1>
          <p className="text-sm text-zinc-600">
            Registrazione veloce. Servizi, orari e banner li imposti dopo nell’area admin.
          </p>
        </div>

        {err ? (
          <div className="text-sm text-red-700 border rounded-xl p-3 bg-red-50">
            {err}
          </div>
        ) : null}

        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">Nome salone</span>
          <input
            value={salonName}
            onChange={e => setSalonName(e.target.value)}
            className="border rounded-xl px-3 py-2"
            placeholder="Es. Barberia By Chri"
            required
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">Email salone (contatto)</span>
          <input
            type="email"
            value={publicEmail}
            onChange={e => setPublicEmail(e.target.value)}
            className="border rounded-xl px-3 py-2"
            placeholder="es. info@tuosalone.it"
            required
          />
        </label>

        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-zinc-500">Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="border rounded-xl px-3 py-2"
              placeholder="min 8 caratteri"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-60"
        >
          {loading ? 'Creazione…' : 'Crea salone'}
        </button>

        <div className="text-[11px] text-zinc-500">
          Email e password serviranno per accedere all’area admin.
        </div>
      </form>
    </main>
  )
}
