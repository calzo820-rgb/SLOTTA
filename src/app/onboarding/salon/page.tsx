'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'



export default function OnboardingSalonPage() {
  const router = useRouter()

  const [salonName, setSalonName] = useState('')
  const [publicEmail, setPublicEmail] = useState('') // email “vera” del salone (contatto)
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

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
  if (!acceptedTerms) return setErr('Devi accettare i Termini e la Privacy Policy.')

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
        acceptedTerms,
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
    <main className="flex min-h-screen items-center justify-center bg-[#F2F4F7] p-6 text-[#0F1D2D]">
      <form
        onSubmit={onSubmit}
        aria-busy={loading}
        className="grid w-full max-w-lg gap-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">Slotta</p>
          <h1 className="mt-1 text-2xl font-black">Registra la tua attività</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Crea l’account gestore. Servizi, orari e grafica si configurano subito dopo.
          </p>
        </div>

        {err ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
            {err}
          </div>
        ) : null}

        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">Nome salone</span>
          <input
            value={salonName}
            onChange={e => setSalonName(e.target.value)}
            className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
            placeholder="Es. Barberia da Chri"
            autoComplete="organization"
            maxLength={120}
            required
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">Email salone (contatto)</span>
          <input
            type="email"
            value={publicEmail}
            onChange={e => setPublicEmail(e.target.value)}
            className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
            placeholder="es. info@tuosalone.it"
            autoComplete="email"
            maxLength={254}
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
              className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
              placeholder="min 8 caratteri"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={event => setAcceptedTerms(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[#1FA7A6]"
            required
          />
          <span>
            Accetto i{' '}
            <Link href="/terms" target="_blank" rel="noreferrer" className="font-bold text-[#1FA7A6] underline">
              Termini del servizio
            </Link>{' '}
            e dichiaro di aver letto la{' '}
            <Link href="/privacy" target="_blank" rel="noreferrer" className="font-bold text-[#1FA7A6] underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-[#FFC145] px-4 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Creazione…' : 'Crea salone'}
        </button>

        <div className="text-center text-xs text-slate-500">
          Email e password serviranno per accedere all’area admin.
        </div>

        <Link href="/login" className="text-center text-sm font-bold text-[#1FA7A6] hover:underline">
          Hai già un account? Accedi
        </Link>
      </form>
    </main>
  )
}
