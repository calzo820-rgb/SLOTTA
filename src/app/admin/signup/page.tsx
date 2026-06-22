'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AdminSignup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  async function signup() {
    setMsg(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setMsg(error.message)
    else setMsg('Utente creato! Ora controlla Supabase → Authentication → Users.')
  }

  return (
    <main className="p-6 max-w-sm mx-auto grid gap-3">
      <h1 className="text-xl font-bold">Crea admin</h1>
      <input className="border p-2 rounded" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="border p-2 rounded" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button className="bg-black text-white rounded p-2" onClick={signup}>Crea</button>
      {msg && <div className="text-sm">{msg}</div>}
    </main>
  )
}
