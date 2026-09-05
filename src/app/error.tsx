'use client'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2F4F7] p-6 text-[#0F1D2D]">
      <div className="grid max-w-md gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">Slotta</p>
        <h1 className="text-2xl font-black">Qualcosa non ha funzionato</h1>
        <p className="text-sm leading-6 text-slate-600">Riprova tra qualche istante. Se il problema continua, contatta l’assistenza.</p>
        <button type="button" onClick={reset} className="rounded-2xl bg-[#FFC145] px-4 py-3 text-sm font-black">Riprova</button>
      </div>
    </main>
  )
}
