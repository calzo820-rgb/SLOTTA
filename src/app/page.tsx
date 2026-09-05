import Link from 'next/link'
import Image from 'next/image'
import InstallAppButton from '@/components/InstallAppButton'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F2F4F7] text-[#0F1D2D]">
      <a
        href="#contenuto"
        className="sr-only z-[100] rounded-xl bg-white px-4 py-2 font-bold focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Vai al contenuto
      </a>
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/icon-192.png"
              alt="Slotta"
              width={40}
              height={40}
              className="h-10 w-10 rounded-2xl border border-slate-200 bg-white object-contain shadow-sm"
            />

            <div className="leading-tight">
              <div className="text-lg font-black tracking-tight text-[#0F1D2D]">
                Slotta
              </div>
              <div className="hidden text-xs font-medium text-slate-500 sm:block">
                Prenotazioni smart
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/login?next=/admin"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
            >
              Accedi
            </Link>

            <Link
              href="/onboarding/salon"
              className="hidden rounded-2xl bg-[#FFC145] px-4 py-2 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:-translate-y-[1px] hover:brightness-95 hover:shadow-md sm:inline-flex"
            >
              Inizia ora
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="contenuto" className="mx-auto grid max-w-7xl scroll-mt-24 gap-8 px-4 py-10 md:grid-cols-[1.05fr_0.95fr] md:items-center md:px-6 md:py-16">
        <div className="grid gap-5">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#1FA7A6]/20 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#1FA7A6] shadow-sm">
            Gestionale prenotazioni
          </div>

          <div className="grid gap-4">
            <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-[#0F1D2D] sm:text-5xl md:text-6xl">
              Gestisci le prenotazioni online senza telefonate, messaggi e confusione.
            </h1>

            <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
              Slotta ti aiuta a ricevere prenotazioni online, organizzare orari, servizi, operatori e appuntamenti da una dashboard semplice, anche da smartphone.
            </p>
          </div>

          <div className="grid gap-3 sm:flex sm:flex-wrap">
            <Link
              href="/onboarding/salon"
              className="inline-flex items-center justify-center rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:-translate-y-[1px] hover:brightness-95 hover:shadow-md"
            >
              Inizia ora
            </Link>

            <InstallAppButton />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xl font-black text-[#0F1D2D]">24/7</div>
              <div className="mt-1 text-xs font-medium text-slate-500">
                Prenotazioni online
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xl font-black text-[#0F1D2D]">€30</div>
              <div className="mt-1 text-xs font-medium text-slate-500">
                Al mese
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xl font-black text-[#0F1D2D]">0%</div>
              <div className="mt-1 text-xs font-medium text-slate-500">
                Commissioni Slotta
              </div>
            </div>
          </div>
        </div>

      {/* MOCKUP */}
<div className="relative">
  <div className="absolute inset-0 -z-10 bg-[#1FA7A6]/10 blur-3xl" />

  <Image
    src="/landing-mockup.png"
    alt="Anteprima Slotta"
    width={1536}
    height={1024}
    priority
    className="w-full rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl"
  />
</div>
      </section>
      {/* TARGET */}
      <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6 md:pb-16">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 p-6 md:grid-cols-[0.9fr_1.1fr] md:items-center md:p-8">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
                Per chi è pensato
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#0F1D2D]">
                Per tutte le attività che lavorano su appuntamento.
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Slotta nasce per semplificare la gestione delle prenotazioni:
                il cliente sceglie servizio, giorno e orario; tu gestisci tutto
                dalla tua area riservata.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                'Parrucchieri',
                'Barberie',
                'Estetiste',
                'Fisioterapisti',
                'Massaggiatori',
                'Personal trainer',
                'Studi privati',
                'Consulenti',
                'Professionisti',
              ].map(item => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-[#F8FAFC] px-3 py-3 text-center text-sm font-black text-[#0F1D2D]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      {/* FEATURES */}
      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-10 md:px-6 md:pb-16">
        <div className="grid gap-2 text-center md:text-left">
          <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
            Cosa puoi gestire
          </p>
          <h2 className="text-3xl font-black tracking-tight text-[#0F1D2D]">
            Tutto quello che serve per partire.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Servizi',
              desc: 'Crea servizi con durata, prezzo, descrizione e immagine.',
            },
            {
              title: 'Orari & capacità',
              desc: 'Imposta giorni di apertura, pause, operatori e disponibilità.',
            },
            {
              title: 'Prenotazioni',
              desc: 'Ricevi richieste, confermale, cancellale e gestisci i pagamenti.',
            },
          ].map(f => (
            <div
              key={f.title}
              className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E6FFFA] text-lg font-black text-[#0F766E]">
                ✓
              </div>

              <h3 className="mt-4 text-xl font-black text-[#0F1D2D]">
                {f.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6 md:pb-16">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
                Prezzo semplice
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#0F1D2D]">
  Un solo prezzo, tutto incluso.
</h2>

              <div className="mt-2 flex items-end gap-2">
                <div className="text-5xl font-black tracking-tight text-[#0F1D2D]">
                  €30
                </div>
                <div className="pb-2 text-sm font-bold text-slate-500">
                  / mese
                </div>
              </div>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Pagina prenotazioni, calendario, servizi, operatori, ferie,
  notifiche e accesso staff. Nessuna commissione Slotta sulle prenotazioni.
              </p>
            </div>

            <Link
              href="/onboarding/salon"
              className="inline-flex items-center justify-center rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:-translate-y-[1px] hover:brightness-95 hover:shadow-md"
            >
              Inizia ora
            </Link>
          </div>
        </div>
      </section>

      {/* CTA MOBILE FISSA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white p-3 shadow-[0_-10px_30px_rgba(15,29,45,0.08)] sm:hidden">
        <Link
          href="/onboarding/salon"
          className="flex w-full items-center justify-center rounded-2xl bg-[#FFC145] px-4 py-3 text-sm font-black text-[#0F1D2D]"
        >
          Inizia ora
        </Link>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white pb-20 sm:pb-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="font-bold">
            © {new Date().getFullYear()} Slotta
          </div>

          <div className="flex flex-wrap gap-4">
  <Link href="/privacy" className="hover:text-[#0F1D2D]">
    Privacy
  </Link>

  <Link href="/terms" className="hover:text-[#0F1D2D]">
    Termini
  </Link>

  <Link href="/contact" className="hover:text-[#0F1D2D]">
    Contatti
  </Link>
</div>
        </div>
      </footer>
    </main>
  )
}
