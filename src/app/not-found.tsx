import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2F4F7] p-6 text-[#0F1D2D]">
      <div className="grid max-w-md gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">Errore 404</p>
        <h1 className="text-2xl font-black">Pagina non trovata</h1>
        <p className="text-sm leading-6 text-slate-600">Il link potrebbe essere errato oppure la pagina non è più disponibile.</p>
        <Link href="/" className="rounded-2xl bg-[#FFC145] px-4 py-3 text-sm font-black">Torna alla home</Link>
      </div>
    </main>
  )
}
