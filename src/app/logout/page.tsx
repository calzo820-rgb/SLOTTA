'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      await supabase.auth.signOut()
      router.replace('/login')
      router.refresh()
    })()
  }, [router])

  return <main className="p-6">Logout…</main>
}
