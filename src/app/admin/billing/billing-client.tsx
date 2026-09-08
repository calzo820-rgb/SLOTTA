'use client'

import { useEffect, useState } from 'react'
import { billingStatusLabel, canUseBillingPortal, normalizeBillingStatus, type BillingStatus } from '@/lib/billing'

type BillingData = {
  billing_customer_id: string | null
  billing_subscription_id: string | null
  billing_status: BillingStatus
  billing_current_period_end: string | null
  trial_ends_at: string | null
  billing_grace_ends_at: string | null
}

export default function BillingClient() {
  const [data, setData] = useState<BillingData | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/billing/status', { cache: 'no-store' })
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Errore')
        if (active) setData(payload)
      })
      .catch(() => {
        if (active) setError('Impossibile caricare lo stato dell’abbonamento.')
      })
    return () => { active = false }
  }, [])

  async function open(action: 'checkout' | 'portal') {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/billing/${action}`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok || !payload.url) throw new Error(payload.error || 'Operazione non disponibile.')
      window.location.assign(payload.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non disponibile.')
      setBusy(false)
    }
  }

  const status = normalizeBillingStatus(data?.billing_status)
  const date = data?.billing_current_period_end || data?.trial_ends_at

  return <main className="min-h-screen bg-[#F2F4F7] px-4 py-6 text-[#0F1D2D]">
    <section className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">Piano Slotta</p>
      <h1 className="mt-1 text-3xl font-black">Abbonamento</h1>
      <div className="mt-6 rounded-3xl bg-[#F8FAFC] p-5">
        <p className="text-xs font-black uppercase text-slate-400">Stato</p>
        <p className="mt-1 text-xl font-black">{data ? billingStatusLabel(status) : 'Caricamento…'}</p>
        {date ? <p className="mt-2 text-sm text-slate-600">Valido fino al {new Date(date).toLocaleDateString('it-IT')}</p> : null}
      </div>
      {error ? <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}
      <button type="button" disabled={busy || !data} onClick={() => open(canUseBillingPortal(data?.billing_customer_id) ? 'portal' : 'checkout')}
        className="mt-6 w-full rounded-2xl bg-[#FFC145] px-5 py-3 font-black disabled:opacity-50">
        {busy ? 'Apertura…' : canUseBillingPortal(data?.billing_customer_id) ? 'Gestisci pagamento e fatture' : 'Attiva Slotta — 30 € al mese'}
      </button>
      <p className="mt-4 text-xs leading-5 text-slate-500">L’abbonamento Slotta è separato dagli incassi delle prenotazioni del tuo salone.</p>
    </section>
  </main>
}
