'use client'

import { FormEvent, useMemo, useState } from 'react'

type FormState = {
  salonName: string
  contactName: string
  phone: string
  city: string
  message: string
  companyWebsite: string
}

const initialForm: FormState = {
  salonName: '',
  contactName: '',
  phone: '',
  city: '',
  message: '',
  companyWebsite: '',
}

function cleanPhoneForWhatsapp(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('39')) return digits
  if (digits.startsWith('0')) return `39${digits}`
  return `39${digits}`
}

export default function TesterLeadClient() {
  const [mode, setMode] = useState<'intro' | 'form' | 'info'>('intro')
  const [form, setForm] = useState<FormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const whatsappNumber = process.env.NEXT_PUBLIC_SLOTTA_WHATSAPP_NUMBER || ''
  const whatsappLabel =
    process.env.NEXT_PUBLIC_SLOTTA_WHATSAPP_LABEL || whatsappNumber

  const whatsappHref = useMemo(() => {
    const cleaned = cleanPhoneForWhatsapp(whatsappNumber)
    if (!cleaned) return ''

    const text = encodeURIComponent(
      'Ciao Christian, ho visto il flyer di Slotta e vorrei capire come diventare tester.',
    )

    return `https://wa.me/${cleaned}?text=${text}`
  }, [whatsappNumber])

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!form.salonName.trim() || form.salonName.trim().length < 2) {
      setError('Inserisci il nome del salone.')
      return
    }

    if (!form.contactName.trim() || form.contactName.trim().length < 2) {
      setError('Inserisci il tuo nome.')
      return
    }

    const digits = form.phone.replace(/\D/g, '')
    if (digits.length < 8) {
      setError('Inserisci un numero WhatsApp valido.')
      return
    }

    if (!form.city.trim() || form.city.trim().length < 2) {
      setError('Inserisci il comune.')
      return
    }

    setLoading(true)

    try {
      const params = new URLSearchParams(window.location.search)

      const res = await fetch('/api/tester-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonName: form.salonName,
          contactName: form.contactName,
          phone: form.phone,
          city: form.city,
          message: form.message,
          companyWebsite: form.companyWebsite,
          source: params.get('source') || 'tester_page',
          pagePath: `${window.location.pathname}${window.location.search}`,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'Errore durante l’invio della richiesta.')
      }

      setSent(true)
      setForm(initialForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l’invio.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-[2rem] border border-[#1FA7A6]/30 bg-white p-6 shadow-xl md:p-7">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#E6FFFA] text-2xl font-black text-[#0F766E]">
          ✓
        </div>

        <h2 className="mt-5 text-3xl font-black tracking-tight">
          Richiesta ricevuta
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Perfetto, ho ricevuto il tuo contatto. Ti ricontatterò io
          personalmente appena possibile per capire insieme se Slotta può essere
          utile al tuo salone.
        </p>

        <div className="mt-6 grid gap-3">
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-[#1FA7A6] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:brightness-95"
            >
              Scrivimi anche su WhatsApp
            </a>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setSent(false)
              setMode('intro')
            }}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
          >
            Invia un’altra richiesta
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl md:p-6">
      {mode === 'intro' ? (
        <div className="grid gap-5">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
              Diventa tester
            </div>

            <h2 className="mt-2 text-3xl font-black tracking-tight">
              Vuoi essere ricontattato?
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Lascia il tuo contatto e ti scrivo io, senza impegno. L’obiettivo
              è attivare Slotta su pochi saloni reali e raccogliere feedback
              concreti.
            </p>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setMode('form')}
              className="rounded-2xl bg-[#FFC145] px-5 py-4 text-left text-sm font-black text-[#0F1D2D] shadow-sm transition hover:-translate-y-[1px] hover:brightness-95"
            >
              Sì, voglio essere ricontattato
              <span className="mt-1 block text-xs font-bold text-[#0F1D2D]/70">
                Compilo nome salone, referente, WhatsApp e comune.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode('info')}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left text-sm font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
            >
              Voglio saperne di più
              <span className="mt-1 block text-xs font-bold text-slate-500">
                Vedo prima cosa fa Slotta e cosa comprende la versione tester.
              </span>
            </button>
          </div>

          {whatsappHref ? (
            <div className="rounded-3xl border border-slate-200 bg-[#F8FAFC] p-4">
              <div className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">
                Preferisci scrivermi subito?
              </div>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex font-black text-[#0F1D2D] hover:text-[#1FA7A6]"
              >
                WhatsApp: {whatsappLabel}
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === 'info' ? (
        <div className="grid gap-5">
          <button
            type="button"
            onClick={() => setMode('intro')}
            className="w-fit text-sm font-black text-[#1FA7A6] hover:underline"
          >
            ← Indietro
          </button>

          <div>
            <h2 className="text-3xl font-black tracking-tight">
              Cosa succede se diventi tester?
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Ti preparo una pagina prenotazioni reale per il tuo salone. Tu
              puoi provarla, condividerla e dirmi cosa manca o cosa rendere più
              comodo.
            </p>
          </div>

          <div className="grid gap-3">
            {[
              'Configurazione iniziale con servizi, prezzi, orari e operatori.',
              'Link prenotazioni da mettere su Instagram, Google, WhatsApp o QR.',
              'Calendario appuntamenti e gestione prenotazioni da pannello admin.',
              'Feedback diretto con me per migliorare Slotta prima del lancio.',
            ].map(item => (
              <div
                key={item}
                className="flex gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 text-sm leading-5 text-slate-600"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1FA7A6] text-xs font-black text-white">
                  ✓
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setMode('form')}
            className="rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:-translate-y-[1px] hover:brightness-95"
          >
            Ok, voglio essere ricontattato
          </button>
        </div>
      ) : null}

      {mode === 'form' ? (
        <form onSubmit={submitLead} className="grid gap-4">
          <button
            type="button"
            onClick={() => setMode('intro')}
            className="w-fit text-sm font-black text-[#1FA7A6] hover:underline"
          >
            ← Indietro
          </button>

          <div>
            <h2 className="text-3xl font-black tracking-tight">
              Lasciami il tuo contatto
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Ti ricontatto io personalmente. Nessun impegno.
            </p>
          </div>

          <label className="grid gap-1.5">
            <span className="text-sm font-black text-[#0F1D2D]">
              Nome salone
            </span>
            <input
              value={form.salonName}
              onChange={e =>
                setForm(prev => ({ ...prev, salonName: e.target.value }))
              }
              placeholder="Es. Barber Luca"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-4 focus:ring-[#1FA7A6]/10"
              autoComplete="organization"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-black text-[#0F1D2D]">
              Nome referente
            </span>
            <input
              value={form.contactName}
              onChange={e =>
                setForm(prev => ({ ...prev, contactName: e.target.value }))
              }
              placeholder="Es. Luca"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-4 focus:ring-[#1FA7A6]/10"
              autoComplete="name"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-black text-[#0F1D2D]">
              Telefono / WhatsApp
            </span>
            <input
              value={form.phone}
              onChange={e =>
                setForm(prev => ({ ...prev, phone: e.target.value }))
              }
              placeholder="Es. 333 123 4567"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-4 focus:ring-[#1FA7A6]/10"
              inputMode="tel"
              autoComplete="tel"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-black text-[#0F1D2D]">Comune</span>
            <input
              value={form.city}
              onChange={e =>
                setForm(prev => ({ ...prev, city: e.target.value }))
              }
              placeholder="Es. Desio"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-4 focus:ring-[#1FA7A6]/10"
              autoComplete="address-level2"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-black text-[#0F1D2D]">
              Messaggio{' '}
              <span className="font-bold text-slate-400">opzionale</span>
            </span>
            <textarea
              value={form.message}
              onChange={e =>
                setForm(prev => ({ ...prev, message: e.target.value }))
              }
              placeholder="Es. Vorrei capire come funziona per il mio salone..."
              className="min-h-24 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-4 focus:ring-[#1FA7A6]/10"
            />
          </label>

          <label className="hidden" aria-hidden="true">
            Website
            <input
              tabIndex={-1}
              value={form.companyWebsite}
              onChange={e =>
                setForm(prev => ({
                  ...prev,
                  companyWebsite: e.target.value,
                }))
              }
              autoComplete="off"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:-translate-y-[1px] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Invio in corso...' : 'Invia richiesta'}
          </button>

          <p className="text-xs leading-5 text-slate-500">
            I dati vengono usati solo per ricontattarti in merito alla fase
            tester di Slotta.
          </p>
        </form>
      ) : null}
    </div>
  )
}