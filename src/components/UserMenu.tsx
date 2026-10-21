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
  aria-expanded={open}
  className="
    group
    flex h-10 w-10 items-center justify-center rounded-full border border-slate-200
    bg-white text-[#0F1D2D]
    transition-all duration-200 ease-out
    hover:-translate-y-[1px]
    hover:scale-105
    hover:shadow-md
    hover:bg-zinc-50
    active:scale-95
    active:shadow-sm
  "
>
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 transition-transform duration-200 group-hover:rotate-6" fill="currentColor">
    <path d="M12 12a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm0 2c-4.1 0-7.5 2.1-7.5 4.75V21h15v-2.25C19.5 16.1 16.1 14 12 14Z" />
  </svg>
</button>



      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white text-[#0F1D2D] shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-sm font-semibold text-[#0F1D2D]">Account</div>
           
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full px-4 py-2 text-left text-sm font-medium text-[#0F1D2D] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1FA7A6]"
          >
            🚪 Esci
          </button>
        </div>
      )}
    </div>
  )
}
