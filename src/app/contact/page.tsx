import Link from 'next/link'

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#F2F4F7] px-4 py-8 text-[#0F1D2D] md:px-6">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <Link
          href="/"
          className="text-sm font-black text-[#1FA7A6] hover:underline"
        >
          ← Torna alla home
        </Link>

        <h1 className="mt-6 text-3xl font-black tracking-tight">
          Contatti
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Hai domande, vuoi provare Slotta o segnalare un problema?
          Puoi contattarci tramite i riferimenti qui sotto.
        </p>

        <div className="mt-8 grid gap-4">
          <div className="rounded-3xl border border-slate-200 bg-[#F8FAFC] p-5">
            <div className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">
              Email
            </div>

            <a
              href="mailto:info@slotta.it"
              className="mt-2 block text-lg font-black text-[#0F1D2D] hover:text-[#1FA7A6]"
            >
              info@slotta.it
            </a>

            <p className="mt-2 text-sm text-slate-500">
              Per informazioni, supporto o richieste commerciali.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-[#F8FAFC] p-5">
            <div className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">
              Stato progetto
            </div>

            <div className="mt-2 text-lg font-black text-[#0F1D2D]">
              Accesso beta privata
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Slotta è attualmente in fase di test e miglioramento continuo.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}