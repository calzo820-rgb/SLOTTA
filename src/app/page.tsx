import Link from 'next/link'

export default function HomePage() {
  const green = 'bg-emerald-600 hover:bg-emerald-700'
  const greenText = 'text-emerald-700'
  const greenRing = 'focus-visible:ring-emerald-500'

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* HEADER */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-bold text-lg tracking-tight">PrenotaOra</div>

          <div className="flex items-center gap-2">
            <Link
              href="/login?next=/admin"
              className={[
                'px-4 py-2 rounded-xl border bg-white text-sm',
                'hover:bg-zinc-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                greenRing,
              ].join(' ')}
            >
              Accedi
            </Link>

            <Link
              href="/onboarding/salon"
              className={[
                'px-4 py-2 rounded-xl text-white text-sm',
                green,
                'shadow-sm',
                'transition-all duration-200 ease-out',
                'hover:-translate-y-[1px] hover:shadow-md',
                'active:translate-y-0 active:shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                greenRing,
              ].join(' ')}
            >
              Crea il tuo salone
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 py-14 grid md:grid-cols-2 gap-10 items-center">
        <div className="grid gap-4">
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
            Prenotazioni online per saloni, senza complicazioni.
          </h1>

          <p className="text-zinc-600 text-lg">
            Pagina prenotazioni pubblica, gestione servizi e calendario, pagamenti online o in salone.
            Tutto in un’unica dashboard.
          </p>

          <div className="flex flex-wrap gap-2">
            {/* CTA primaria unica */}
            <Link
              href="/onboarding/salon"
              className={[
                'px-5 py-3 rounded-xl text-white',
                green,
                'shadow-sm',
                'transition-all duration-200 ease-out',
                'hover:-translate-y-[1px] hover:shadow-md',
                'active:translate-y-0 active:shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                greenRing,
              ].join(' ')}
            >
              Crea il tuo salone
            </Link>

            {/* CTA secondaria */}
            <Link
              href="/login?next=/admin"
              className={[
                'px-5 py-3 rounded-xl border bg-white',
                'hover:bg-zinc-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                greenRing,
              ].join(' ')}
            >
              Accedi
            </Link>
          </div>

          <div className="text-xs text-zinc-500">
            Setup in pochi minuti. Poi configuri servizi e orari dalla tua area admin.
          </div>
        </div>

        {/* BOX "Cosa ottieni" */}
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="text-sm font-semibold mb-3">Cosa ottieni</div>
          <ul className="grid gap-2 text-sm text-zinc-700">
            <li className="flex items-start gap-2">
              <span className={greenText}>✅</span>
              <span>Pagina prenotazione per i clienti</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={greenText}>✅</span>
              <span>Servizi con immagini e prezzi</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={greenText}>✅</span>
              <span>Calendario + disponibilità per giorno</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={greenText}>✅</span>
              <span>Pagamento: online / in salone / scelta cliente</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={greenText}>✅</span>
              <span>Email automatiche di conferma/cancellazione</span>
            </li>
          </ul>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-6 pb-14 grid gap-6">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: 'Servizi', desc: 'Crea servizi, durata e prezzo. Immagini incluse.' },
            { title: 'Orari & capacità', desc: 'Imposta orari per giorno e quante persone puoi gestire.' },
            { title: 'Pagamenti', desc: 'Online, in salone oppure decide il cliente.' },
          ].map(f => (
            <div
              key={f.title}
              className={[
                'bg-white border rounded-2xl p-5 shadow-sm',
                'hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 ease-out',
              ].join(' ')}
            >
              <div className="font-semibold flex items-center gap-2">
                <span className={greenText}>●</span>
                {f.title}
              </div>
              <div className="text-sm text-zinc-600 mt-2">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="max-w-6xl mx-auto px-6 pb-14">
        <div className="bg-white border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-sm text-zinc-500">Prezzo</div>
            <div className="text-2xl font-bold">€30/mese</div>
            <div className="text-sm text-zinc-600 mt-1">
              Tutto incluso. SMS reminder opzionali <span className="font-medium">+€10/mese</span>.
            </div>
          </div>

          <Link
            href="/onboarding/salon"
            className={[
              'px-5 py-3 rounded-xl text-white w-fit',
              green,
              'shadow-sm',
              'transition-all duration-200 ease-out',
              'hover:-translate-y-[1px] hover:shadow-md',
              'active:translate-y-0 active:shadow-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              greenRing,
            ].join(' ')}
          >
            Crea il tuo salone
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-zinc-500 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
          <div>© {new Date().getFullYear()} PrenotaOra</div>
          <div className="flex gap-4">
            <span className="hover:text-zinc-700 cursor-pointer">Privacy</span>
            <span className="hover:text-zinc-700 cursor-pointer">Termini</span>
            <span className="hover:text-zinc-700 cursor-pointer">Contatti</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
