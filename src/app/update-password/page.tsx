'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function UpdatePasswordPage() {
  const [checking, setChecking] = useState(true)
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setReady(Boolean(data.session))
        setChecking(false)
      }
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) {
        setReady(true)
        setChecking(false)
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) return setError('La password deve contenere almeno 8 caratteri.')
    if (password !== confirmPassword) return setError('Le password non coincidono.')

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      console.error('password update failed', updateError)
      setError('Il link non è valido o è scaduto. Richiedine uno nuovo.')
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    setDone(true)
    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2F4F7] p-6 text-[#0F1D2D]">
      <div className="grid w-full max-w-md gap-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">Slotta</p>
          <h1 className="mt-1 text-2xl font-black">Imposta una nuova password</h1>
        </div>

        {checking ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600" role="status">Verifica del link…</div>
        ) : done ? (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" role="status">Password aggiornata correttamente.</div>
            <Link href="/login" className="rounded-2xl bg-[#FFC145] px-4 py-3 text-center text-sm font-black">Accedi</Link>
          </div>
        ) : ready ? (
          <form onSubmit={submit} className="grid gap-4">
            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</div> : null}
            <label className="grid gap-1"><span className="text-sm font-bold">Nuova password</span><input type="password" minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-[#1FA7A6]" /></label>
            <label className="grid gap-1"><span className="text-sm font-bold">Ripeti password</span><input type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-[#1FA7A6]" /></label>
            <button type="submit" disabled={loading} className="rounded-2xl bg-[#FFC145] px-4 py-3 text-sm font-black disabled:opacity-60">{loading ? 'Salvataggio…' : 'Aggiorna password'}</button>
          </form>
        ) : (
          <div className="grid gap-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900" role="alert">Il link non è valido o è scaduto.</div>
            <Link href="/forgot-password" className="text-center text-sm font-bold text-[#1FA7A6] hover:underline">Richiedi un nuovo link</Link>
          </div>
        )}
      </div>
    </main>
  )
}
