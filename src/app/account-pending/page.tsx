import Link from 'next/link'

export default function AccountPendingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2F4F7] p-6 text-[#0F1D2D]">
      <section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[#FFF7E0] text-2xl">⏳</div>
        <p className="mt-5 text-sm font-black uppercase tracking-wide text-[#1FA7A6]">Slotta tester</p>
        <h1 className="mt-2 text-2xl font-black">Richiesta ricevuta</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Il tuo account è stato creato, ma deve ancora essere approvato. Ti ricontatteremo per completare insieme la configurazione del salone.
        </p>
        <Link href="/login" className="mt-6 inline-flex rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black text-[#0F1D2D]">Torna al login</Link>
      </section>
    </main>
  )
}
