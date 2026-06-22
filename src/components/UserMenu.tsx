'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function UserMenu() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement | null>(null)

  // chiudi menu se clicchi fuori
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    setOpen(false)
    router.replace('/login')
    router.refresh()
  }

  return (
    <div ref={ref} className="relative">
     <button
  type="button"
  onClick={() => setOpen(v => !v)}
  aria-label="Account"
  title="Account"
  className="
    group
    h-10 w-10 rounded-full border
    bg-white flex items-center justify-center
    transition-all duration-200 ease-out
    hover:-translate-y-[1px]
    hover:scale-105
    hover:shadow-md
    hover:bg-zinc-50
    active:scale-95
    active:shadow-sm
  "
>
  <span className="transition-transform duration-200 group-hover:rotate-6">
    👤
  </span>
</button>



      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white border rounded-2xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b">
            <div className="text-sm font-semibold">Account</div>
           
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50"
          >
            🚪 Esci
          </button>
        </div>
      )}
    </div>
  )
}
