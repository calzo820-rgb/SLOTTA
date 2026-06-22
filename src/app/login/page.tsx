'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  normalizeStaffCode,
  normalizeUsername,
  staffUsernameToEmail,
} from '@/lib/usernames'

type LoginMode = 'owner' | 'staff'

function LoginContent() {
  const router = useRouter()
  const sp = useSearchParams()

  const [mode, setMode] = useState<LoginMode>('owner')
  const [email, setEmail] = useState('')
  const [staffCode, setStaffCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [checkingSession, setCheckingSession] = useState(true)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const next = sp.get('next') || '/admin'

useEffect(() => {
  let cancelled = false

  async function checkSession() {
    setCheckingSession(true)

    try {
      const { data, error } = await supabase.auth.getSession()

      if (cancelled) return

      if (error) {
        console.error('Errore controllo sessione:', error)
        setCheckingSession(false)
        return
      }

      if (data.session) {
        router.replace(next)
        return
      }

      setCheckingSession(false)
    } catch (e) {
      console.error('Errore checkSession login:', e)

      if (!cancelled) {
        setCheckingSession(false)
      }
    }
  }

  checkSession()

  return () => {
    cancelled = true
  }
}, [router, next])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    setLoading(true)
    setErr(null)

    try {
      let emailForLogin = ''

      if (mode === 'owner') {
        const cleanEmail = email.trim().toLowerCase()

        if (!cleanEmail || !cleanEmail.includes('@')) {
          throw new Error('Inserisci una email valida.')
        }

        emailForLogin = cleanEmail
      }

      if (mode === 'staff') {
        const cleanCode = normalizeStaffCode(staffCode)
        const cleanUsername = normalizeUsername(username)

        if (!/^[0-9]{6}$/.test(cleanCode)) {
          throw new Error('Inserisci il codice attività di 6 cifre.')
        }

        if (cleanUsername.length < 3) {
          throw new Error('Inserisci uno username valido.')
        }

        emailForLogin = staffUsernameToEmail(cleanUsername, cleanCode)
      }

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: emailForLogin,
        password,
      })

      if (error) {
        throw new Error('Credenziali non valide.')
      }

      if (!authData.session) {
        throw new Error('Sessione non creata.')
      }

setCheckingSession(true)
router.replace(next)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Errore login'
      setErr(message)
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F2F4F7] p-6 text-[#0F1D2D]">
        <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-5 text-sm font-bold text-slate-600 shadow-sm">
          Controllo accesso…
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2F4F7] p-6 text-[#0F1D2D]">
      <form
        onSubmit={onSubmit}
        className="grid w-full max-w-md gap-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
            Slotta
          </p>

          <h1 className="mt-1 text-2xl font-black">
            Accedi al gestionale
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Entra come gestore oppure come membro dello staff.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F2F4F7] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('owner')
              setErr(null)
            }}
            className={[
              'rounded-xl px-4 py-2 text-sm font-black transition',
              mode === 'owner'
                ? 'bg-white text-[#0F1D2D] shadow-sm'
                : 'text-slate-500 hover:text-[#0F1D2D]',
            ].join(' ')}
          >
            Gestore
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('staff')
              setErr(null)
            }}
            className={[
              'rounded-xl px-4 py-2 text-sm font-black transition',
              mode === 'staff'
                ? 'bg-white text-[#0F1D2D] shadow-sm'
                : 'text-slate-500 hover:text-[#0F1D2D]',
            ].join(' ')}
          >
            Staff
          </button>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
            {err}
          </div>
        ) : null}

        {mode === 'owner' ? (
          <label className="grid gap-1">
            <span className="text-sm font-bold">Email gestore</span>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
              required
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="es. admin@slotta.it"
              type="email"
            />
          </label>
        ) : (
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm font-bold">Codice attività</span>
              <input
                value={staffCode}
                onChange={e => setStaffCode(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                required
                inputMode="numeric"
                placeholder="es. 482913"
                maxLength={6}
              />
              <span className="text-xs text-slate-500">
                Lo trovi nelle informazioni fornite dal gestore.
              </span>
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-bold">Username staff</span>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                required
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="es. reception"
              />
            </label>
          </div>
        )}

        <label className="grid gap-1">
          <span className="text-sm font-bold">Password</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-[#FFC145] px-4 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Accesso…' : 'Accedi'}
        </button>

        {mode === 'owner' ? (
          <>
            <div className="h-px bg-slate-100" />

            <div className="grid gap-2 text-center">
              <p className="text-sm text-slate-500">
                Non hai ancora un account?
              </p>

              <button
                type="button"
                onClick={() => router.push('/onboarding/salon')}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
              >
                Registra la tua attività
              </button>
            </div>
          </>
        ) : null}
      </form>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}