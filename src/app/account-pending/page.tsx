'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AccountPendingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function checkApproval() {
      const { data: authData } = await supabase.auth.getSession()
      const user = authData.session?.user

      if (!user) {
        if (!cancelled) setChecking(false)
        return
      }

      const { data: membership, error } = await supabase
        .from('tenant_users')
        .select('is_active')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      if (!error && membership?.is_active === true) {
        router.replace('/admin')
        return
      }

      setChecking(false)
    }

    void checkApproval()
    return () => { cancelled = true }
  }, [router])

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F2F4F7] p-6 text-[#0F1D2D]">
        <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-5 text-sm font-bold text-slate-600 shadow-sm">
          Verifico lo stato della richiesta…
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2F4F7] p-6 text-[#0F1D2D]">
      <section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[#FFF7E0] text-2xl">⏳</div>
        <p className="mt-5 text-sm font-black uppercase tracking-wide text-[#1FA7A6]">Slotta tester</p>
        <h1 className="mt-2 text-2xl font-black">Richiesta ricevuta</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Il tuo account è stato creato, ma deve ancora essere approvato. Ti ricontatteremo per completare insieme la configurazione del salone.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="inline-flex justify-center rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black text-[#0F1D2D] disabled:opacity-60"
          >
            {signingOut ? 'Uscita…' : 'Esci dall’account'}
          </button>
          <Link href="/login" className="inline-flex justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-[#0F1D2D]">
            Torna al login
          </Link>
        </div>
      </section>
    </main>
  )
}
