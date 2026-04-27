'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { normalizeUsername, usernameToEmail } from '@/lib/usernames'


export default function LoginPage() {
  const router = useRouter()
  const sp = useSearchParams()

  const [userOrEmail, setUserOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const next = sp.get('next') || '/admin'

  // ✅ se sei già loggato, NON devi rifare login
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.replace(next)
        router.refresh()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErr(null)

    try {
      const input = normalizeUsername(userOrEmail)

      // se contiene "@", lo tratto come email reale
      const email = input.includes('@') ? input : usernameToEmail(input)

      const { data: authData, error } = await supabase.auth.signInWithPassword({
  email,
  password,
})

if (error) throw error
if (!authData.session) throw new Error('Sessione non creata.')

router.replace(next)
router.refresh()
    } catch (e: any) {
      setErr(e?.message || 'Errore login')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-6 grid gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold">Login</h1>
          <p className="text-sm text-zinc-600">
            Accedi con <strong>email</strong> oppure <strong>username</strong>.
          </p>
        </div>

        {err ? (
          <div className="text-sm text-red-700 border rounded-xl p-3 bg-red-50">
            {err}
          </div>
        ) : null}

        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">Email o Username</span>
          <input
            value={userOrEmail}
            onChange={e => setUserOrEmail(e.target.value)}
            className="border rounded-xl px-3 py-2"
            required
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">Password</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="border rounded-xl px-3 py-2"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-60"
        >
          {loading ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
    </main>
  )
}
