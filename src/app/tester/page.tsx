import Link from 'next/link'
import Image from 'next/image'
import TesterLeadClient from './tester-lead-client'

export const metadata = {
  title: 'Diventa tester | Slotta',
  description:
    'Slotta cerca parrucchieri e barber shop tester in Monza e Brianza e dintorni.',
}

export default function TesterPage() {
  return (
    <main className="min-h-screen bg-[#F2F4F7] text-[#0F1D2D]">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/icon-192.png"
              alt="Slotta"
              width={44}
              height={44}
              className="h-11 w-11 rounded-2xl border border-slate-200 bg-white object-contain shadow-sm"
            />
            <div className="leading-tight">
              <div className="text-xl font-black tracking-tight">Slotta</div>
              <div className="text-xs font-bold text-slate-500">
                Prenotazioni online semplici
              </div>
            </div>
          </Link>

          <Link
            href="/"
            className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6] sm:inline-flex"
          >
            Torna al sito
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[1.05fr_0.95fr] md:items-center md:px-6 md:py-14">
        <div className="grid gap-5">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#1FA7A6]/25 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#1FA7A6] shadow-sm">
            Ricerca tester · Monza e Brianza
          </div>

          <div className="grid gap-4">
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-[#0F1D2D] sm:text-5xl md:text-6xl">
              Vuoi provare Slotta sul tuo salone?
            </h1>

            <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
              Sto cercando pochi parrucchieri e barber shop tester in zona.
              Non è una demo pubblica: ti configuro una versione reale di
              Slotta con i tuoi servizi, i tuoi orari e il tuo link prenotazioni.
            </p>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E6FFFA] text-xl font-black text-[#0F766E]">
                ✓
              </div>
              <div>
                <h2 className="text-lg font-black">
                  Ultima fase prima del lancio
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  In questa fase raccolgo feedback reali da chi lavora ogni
                  giorno in salone, per migliorare le ultime funzioni prima del
                  lancio.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Locale', 'Nato qui, vicino ai saloni della zona.'],
              ['Agile', 'Le richieste utili possono entrare nella versione finale.'],
              ['Reale', 'Lo usi davvero, con i tuoi dati e il tuo link.'],
            ].map(([title, desc]) => (
              <div
                key={title}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
                  {title}
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-600">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <TesterLeadClient />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-6 md:pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Cosa attiviamo',
              items: [
                'Pagina online del tuo salone',
                'Link prenotazioni condivisibile',
                'Servizi, prezzi, orari e operatori',
              ],
            },
            {
              title: 'Come lo usi',
              items: [
                'Calendario appuntamenti reale',
                'Gestione prenotazioni da admin',
                'Email automatiche di conferma',
              ],
            },
            {
              title: 'Perché farlo ora',
              items: [
                'Ti seguo personalmente',
                'Puoi suggerire modifiche',
                'Nessun impegno iniziale',
              ],
            },
          ].map(block => (
            <div
              key={block.title}
              className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-xl font-black text-[#0F1D2D]">
                {block.title}
              </h3>
              <ul className="mt-4 grid gap-3 text-sm text-slate-600">
                {block.items.map(item => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1FA7A6] text-xs font-black text-white">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
