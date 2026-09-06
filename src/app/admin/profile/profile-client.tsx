'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '@/lib/supabaseClient'

type TenantProfile = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  staff_login_code: string | null
  contact_email: string | null
  phone: string | null
  whatsapp_phone: string | null
  address: string | null
  instagram_url: string | null
  website_url: string | null
}
type StripeConnectStatus = {
  connected: boolean
  account_id?: string
  details_submitted: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  disabled_reason: string | null
  requirements: unknown
}
const LOGO_BUCKET = 'logos'
async function uploadLogoForTenant(file: File, tenantId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = `${tenantId}/${fileName}`

  const { error: uploadErr } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })

  if (uploadErr) throw uploadErr

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
function slugifyName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6)
}

async function generateUniqueTenantSlug(name: string, tenantId: string) {
  const baseSlug = slugifyName(name) || `attivita-${randomSuffix()}`
  let candidate = baseSlug

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', candidate)
      .neq('id', tenantId)
      .maybeSingle()

    if (error) throw error

    if (!data) return candidate

    candidate = `${baseSlug}-${randomSuffix()}`
  }

  return `${baseSlug}-${Date.now().toString(36)}`
}
export default function ProfileClient({ tenantId }: { tenantId: string }) {
  const [profile, setProfile] = useState<TenantProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [exporting, setExporting] = useState(false)
  const [connectLoading, setConnectLoading] = useState(false)
const [connectError, setConnectError] = useState<string | null>(null)
const [connectStatus, setConnectStatus] = useState<StripeConnectStatus | null>(null)
const [connectStatusLoading, setConnectStatusLoading] = useState(false)
const [mobileSections, setMobileSections] = useState({
  details: false,
  identity: false,
  links: false,
  staff: false,
  data: false,
})

function toggleMobileSection(section: keyof typeof mobileSections) {
  setMobileSections(prev => ({
    ...prev,
    [section]: !prev[section],
  }))
}
  const publicLink = useMemo(() => {
    if (!profile?.slug) return ''
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/t/${profile.slug}`
  }, [profile?.slug])

  async function loadProfile() {
    if (!tenantId) return

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('tenants')
        .select(
  'id, name, slug, logo_url, staff_login_code, contact_email, phone, whatsapp_phone, address, instagram_url, website_url',
)
        .eq('id', tenantId)
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('Profilo attività non trovato.')

      setProfile(data as TenantProfile)
    } catch (e: unknown) {
  const message = e instanceof Error ? e.message : 'Errore caricamento profilo attività.'
  setError(message)
} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])
useEffect(() => {
  loadStripeConnectStatus()
   
}, [tenantId])

  function updateField<K extends keyof TenantProfile>(key: K, value: TenantProfile[K]) {
    setProfile(prev => (prev ? { ...prev, [key]: value } : prev))
  }

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text)
      setMsg(successMessage)
      window.setTimeout(() => setMsg(null), 2500)
    } catch {
      setError('Impossibile copiare negli appunti.')
    }
  }
function downloadQrCode() {
  try {
    const canvas = document.getElementById('booking-qr-code') as HTMLCanvasElement | null

    if (!canvas) {
      setError('QR code non disponibile.')
      return
    }

    const pngUrl = canvas.toDataURL('image/png')

    const link = document.createElement('a')
    link.href = pngUrl
    link.download = `slotta-qr-${profile?.slug || 'prenotazioni'}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setMsg('QR code scaricato.')
    window.setTimeout(() => setMsg(null), 2500)
  } catch {
    setError('Impossibile scaricare il QR code.')
  }
}
async function loadStripeConnectStatus() {
  try {
    setConnectStatusLoading(true)
    setConnectError(null)

    const res = await fetch('/api/stripe-connect/status', {
      method: 'GET',
    })

    const json = await res.json().catch(() => null)

    if (!res.ok) {
      throw new Error(
        json?.error || 'Errore durante il controllo dello stato Stripe Connect.',
      )
    }

    setConnectStatus(json)
} catch (e: unknown) {
  const message =
    e instanceof Error
      ? e.message
      : 'Errore durante il controllo dello stato Stripe Connect.'

  setConnectError(message)
} finally {
    setConnectStatusLoading(false)
  }
}

async function startStripeConnectOnboarding() {
  try {
    setConnectLoading(true)
    setConnectError(null)

    const res = await fetch('/api/stripe-connect/onboarding', {
      method: 'POST',
    })

    const json = await res.json().catch(() => null)

    if (!res.ok) {
      throw new Error(
        json?.error || 'Errore durante l’attivazione dei pagamenti online.',
      )
    }

    if (!json?.url) {
      throw new Error('Link Stripe non ricevuto.')
    }

    window.location.href = json.url
 } catch (e: unknown) {
  const message =
    e instanceof Error
      ? e.message
      : 'Errore durante l’attivazione dei pagamenti online.'

  setConnectError(message)
} finally {
    setConnectLoading(false)
  }
}

async function exportTenantData() {
  try {
    setExporting(true)
    setError(null)

    const response = await fetch('/api/admin/export-data', {
      method: 'GET',
      cache: 'no-store',
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.error || 'Impossibile esportare i dati.')
    }

    const blob = await response.blob()
    const disposition = response.headers.get('content-disposition') || ''
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'slotta-export.json'
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setMsg('Esportazione completata.')
    window.setTimeout(() => setMsg(null), 2500)
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'Impossibile esportare i dati.')
  } finally {
    setExporting(false)
  }
}
  async function saveProfile() {
  if (!profile) return

  if (!profile.name.trim()) {
    setError('Il nome attività è obbligatorio.')
    return
  }

  setSaving(true)
  setError(null)
  setMsg(null)

 try {
  let logoUrl = profile.logo_url || null

  if (logoFile) {
    logoUrl = await uploadLogoForTenant(logoFile, tenantId)
  }

  const nextName = profile.name.trim()
  const nextSlug = await generateUniqueTenantSlug(nextName, tenantId)

  const payload = {
    name: nextName,
    slug: nextSlug,
    logo_url: logoUrl,
    contact_email: profile.contact_email?.trim() || null,
    phone: profile.phone?.trim() || null,
    whatsapp_phone: profile.whatsapp_phone?.trim() || null,
    address: profile.address?.trim() || null,
    instagram_url: profile.instagram_url?.trim() || null,
    website_url: profile.website_url?.trim() || null,
  }

    const { error } = await supabase
      .from('tenants')
      .update(payload)
      .eq('id', tenantId)

    if (error) throw error

    setProfile(prev => (prev ? { ...prev, ...payload } : prev))
    setLogoFile(null)

    setMsg('Profilo attività aggiornato.')
    window.setTimeout(() => setMsg(null), 2500)
 } catch (e: unknown) {
  const message = e instanceof Error ? e.message : 'Errore salvataggio profilo attività.'
  setError(message)
} finally {
    setSaving(false)
  }
}

  return (
    <main className="min-h-screen bg-[#F2F4F7] px-4 py-5 text-[#0F1D2D] md:px-6">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header>
          <p className="hidden text-sm font-black uppercase tracking-wide text-[#1FA7A6] md:block">
            Area gestore
          </p>

          <h1 className="hidden text-3xl font-black tracking-tight text-[#0F1D2D] md:block">
            Profilo attività
          </h1>

          <p className="text-sm text-slate-600 md:mt-1">
            Gestisci le informazioni principali della tua attività e i link da condividere.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {msg ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
            {msg}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Caricamento profilo…
          </div>
        ) : profile ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">

            <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
  {/* HEADER DESKTOP */}
  <div className="hidden border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 md:block">
    <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
      Dati attività
    </p>
    <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
      Informazioni principali
    </h2>
    <p className="mt-1 text-sm text-slate-500">
      Queste informazioni ti aiutano a presentare meglio l’attività.
    </p>
  </div>

  {/* HEADER MOBILE */}
  <button
    type="button"
    onClick={() => toggleMobileSection('details')}
    className="flex w-full items-center justify-between border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 text-left md:hidden"
  >
    <div>
      <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
        Dati attività
      </p>
      <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
        Informazioni principali
      </h2>
    </div>

    <span className="text-sm font-black text-slate-400">
      {mobileSections.details ? '▲' : '▼'}
    </span>
  </button>

              <div className={mobileSections.details ? 'block' : 'hidden md:block'}>
  <div className="grid gap-4 p-5">
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-[#0F1D2D]">
                    Nome attività
                  </span>
                  <input
                    value={profile.name}
                    onChange={e => updateField('name', e.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                    placeholder="Es. Barberia"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
  <label className="grid gap-1">
    <span className="text-sm font-bold text-[#0F1D2D]">
      Email attività
    </span>
    <input
      value={profile.contact_email || ''}
      onChange={e => updateField('contact_email', e.target.value)}
      className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
      placeholder="es. info@barberia.it"
      type="email"
    />
    <span className="text-xs text-slate-500">
      Verrà mostrata nella pagina cliente.
    </span>
  </label>

  <label className="grid gap-1">
    <span className="text-sm font-bold text-[#0F1D2D]">
      Telefono
    </span>
    <input
      value={profile.phone || ''}
      onChange={e => updateField('phone', e.target.value)}
      className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
      placeholder="es. +39 333 123 4567"
    />
    <span className="text-xs text-slate-500">
      Verrà usato per il pulsante chiamata.
    </span>
  </label>
</div>

<div className="grid gap-4 md:grid-cols-2">
  <label className="grid gap-1">
    <span className="text-sm font-bold text-[#0F1D2D]">
      WhatsApp
    </span>
    <input
      value={profile.whatsapp_phone || ''}
      onChange={e => updateField('whatsapp_phone', e.target.value)}
      className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
      placeholder="es. +39 333 123 4567"
    />
    <span className="text-xs text-slate-500">
      Verrà usato per il pulsante WhatsApp nella pagina cliente.
    </span>
  </label>

  <label className="grid gap-1">
    <span className="text-sm font-bold text-[#0F1D2D]">
      Indirizzo
    </span>
    <input
      value={profile.address || ''}
      onChange={e => updateField('address', e.target.value)}
      className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
      placeholder="es. Via Roma 10, Bovisio Masciago"
    />
    <span className="text-xs text-slate-500">
      Verrà usato per aprire Google Maps dalla pagina cliente.
    </span>
  </label>
</div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-[#0F1D2D]">
                      Instagram
                    </span>
                    <input
                      value={profile.instagram_url || ''}
                      onChange={e => updateField('instagram_url', e.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                      placeholder="es. https://instagram.com/barberia"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-[#0F1D2D]">
                      Sito web
                    </span>
                    <input
                      value={profile.website_url || ''}
                      onChange={e => updateField('website_url', e.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
                      placeholder="es. https://barberia.it"
                    />
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={saving}
                    className="w-full rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                  >
                    {saving ? 'Salvataggio…' : 'Salva profilo'}
                  </button>
                </div>
              </div>
               </div>
            </section>

            <aside className="grid gap-5">
              <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
  {/* HEADER DESKTOP */}
  <div className="hidden border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 md:block">
    <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
      Identità
    </p>
    <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
      Logo attività
    </h2>
  </div>

  {/* HEADER MOBILE */}
  <button
    type="button"
    onClick={() => toggleMobileSection('identity')}
    className="flex w-full items-center justify-between border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 text-left md:hidden"
  >
    <div>
      <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
        Identità
      </p>
      <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
        Logo attività
      </h2>
    </div>

    <span className="text-sm font-black text-slate-400">
      {mobileSections.identity ? '▲' : '▼'}
    </span>
  </button>

  <div className={mobileSections.identity ? 'block' : 'hidden md:block'}>
  <div className="grid gap-4 p-5">
    <div className="flex items-center gap-4">
      {logoFile ? (
        <Image
          src={URL.createObjectURL(logoFile)}
          alt={profile.name}
          width={64}
          height={64}
          unoptimized
          className="h-16 w-16 rounded-2xl border border-slate-200 bg-white object-cover shadow-sm"
        />
      ) : profile.logo_url ? (
        <Image
          src={profile.logo_url}
          alt={profile.name}
          width={64}
          height={64}
          unoptimized
          className="h-16 w-16 rounded-2xl border border-slate-200 bg-white object-cover shadow-sm"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-[#F8FAFC] text-xs font-bold text-slate-400">
          Logo
        </div>
      )}

      <div className="min-w-0">
        <div className="truncate text-sm font-black text-[#0F1D2D]">
          {profile.name}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Logo visibile nella pagina cliente.
        </div>
      </div>
    </div>

    <div className="flex flex-wrap gap-2">
      <input
        id="profile-logo-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => setLogoFile(e.target.files?.[0] || null)}
      />

      <label
        htmlFor="profile-logo-upload"
        className="inline-flex cursor-pointer select-none items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
      >
        🖼️ Cambia logo
      </label>

      {logoFile ? (
        <button
          type="button"
          onClick={() => setLogoFile(null)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
        >
          Annulla
        </button>
      ) : null}
    </div>

    <p className="text-xs leading-5 text-slate-500">
      Consigliato formato quadrato, leggibile anche piccolo.
    </p>
  </div>
</div>
              </section>

              <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
  {/* HEADER DESKTOP */}
  <div className="hidden border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 md:block">
    <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
      Link prenotazioni
    </p>
    <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
      Prenotazione online
    </h2>
  </div>

  {/* HEADER MOBILE */}
  <button
    type="button"
    onClick={() => toggleMobileSection('links')}
    className="flex w-full items-center justify-between border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 text-left md:hidden"
  >
    <div>
      <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
        Link prenotazioni
      </p>
      <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
        Prenotazione online
      </h2>
    </div>

    <span className="text-sm font-black text-slate-400">
      {mobileSections.links ? '▲' : '▼'}
    </span>
  </button>

  <div className={mobileSections.links ? 'block' : 'hidden md:block'}>
    <div className="grid gap-3 p-5">
                  <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3">
                    <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                      Link da condividere con i clienti
                    </div>
                    <div className="mt-1 break-all text-sm font-bold text-[#0F1D2D]">
                      {publicLink || 'Link non disponibile'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(publicLink, 'Link pubblico copiato.')}
                      disabled={!publicLink}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6] disabled:opacity-50"
                    >
                      Copia link
                    </button>

                    <Link
                      href={`/t/${profile.slug}`}
                      target="_blank"
                      className="rounded-2xl bg-[#1FA7A6] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-[#0F766E]"
                    >
                      Apri pagina
                    </Link>
                  </div>
{publicLink ? (
  <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="grid gap-4">
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">
          QR code prenotazioni
        </p>

        <h3 className="mt-1 text-lg font-black leading-tight text-[#0F1D2D]">
          Fai prenotare i clienti con una scansione
        </h3>

        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          Mostra questo QR in reception oppure stampalo su un biglietto.
          Il cliente apre subito la pagina di prenotazione.
        </p>
      </div>

      <div className="flex justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <QRCodeCanvas
            id="booking-qr-code"
            value={publicLink}
            size={180}
            level="H"
            includeMargin
          />
        </div>
      </div>

<button
  type="button"
  onClick={downloadQrCode}
  className="min-h-[48px] w-full rounded-2xl bg-[#0F1D2D] px-4 py-3 text-sm font-black text-white transition hover:bg-[#1FA7A6]"
>
  Scarica QR
</button>

      <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-500">
        Consiglio: stampalo vicino alla cassa o allo specchio, così i clienti
        possono prenotare il prossimo appuntamento in autonomia.
      </p>
    </div>
  </div>
) : null}
                </div>
                </div>
              </section>
                           <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4">
                  <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
                    Pagamenti online
                  </p>
                  <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
                    Stripe Connect
                  </h2>
                </div>

                <div className="grid gap-4 p-5">
                  {connectStatusLoading ? (
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
                      Controllo stato pagamenti...
                    </p>
                  ) : connectStatus?.charges_enabled && connectStatus?.payouts_enabled ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-sm font-black text-emerald-800">
                        Pagamenti online attivi
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-emerald-700">
                        Il conto del salone è collegato correttamente. I clienti potranno
                        pagare online quando questa modalità sarà abilitata.
                      </p>
                    </div>
                  ) : connectStatus?.connected ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm font-black text-amber-800">
                        Configurazione Stripe da completare
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-amber-700">
                        Il conto è stato creato, ma Stripe richiede ancora alcune
                        informazioni prima di abilitare pagamenti e bonifici.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-black text-slate-800">
                        Pagamenti online non attivi
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                        Collega il conto del salone per ricevere pagamenti online dai clienti.
                        La procedura è guidata e sicura.
                      </p>
                    </div>
                  )}

                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-500">
                    Il pagamento in salone rimane sempre disponibile. I pagamenti online
                    saranno disponibili solo quando Stripe Connect risulta attivo.
                  </p>

                  {connectError ? (
                    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                      {connectError}
                    </p>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={startStripeConnectOnboarding}
                      disabled={connectLoading}
                      className="min-h-[48px] w-full rounded-2xl bg-[#0F1D2D] px-4 py-3 text-sm font-black text-white transition hover:bg-[#1FA7A6] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {connectLoading
                        ? 'Apertura Stripe…'
                        : connectStatus?.connected
                          ? 'Gestisci configurazione Stripe'
                          : 'Attiva pagamenti online'}
                    </button>

                    <button
                      type="button"
                      onClick={loadStripeConnectStatus}
                      disabled={connectStatusLoading}
                      className="min-h-[48px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {connectStatusLoading ? 'Aggiornamento…' : 'Aggiorna stato'}
                    </button>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                <div className="hidden border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 md:block">
                  <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">Dati e privacy</p>
                  <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">Esporta i dati</h2>
                </div>

                <button
                  type="button"
                  onClick={() => toggleMobileSection('data')}
                  aria-expanded={mobileSections.data}
                  className="flex w-full items-center justify-between border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 text-left md:hidden"
                >
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">Dati e privacy</p>
                    <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">Esporta i dati</h2>
                  </div>
                  <span aria-hidden="true" className="text-sm font-black text-slate-400">
                    {mobileSections.data ? '▲' : '▼'}
                  </span>
                </button>

                <div className={mobileSections.data ? 'block' : 'hidden md:block'}>
                  <div className="grid gap-3 p-5">
                    <p className="text-sm leading-6 text-slate-600">
                      Scarica una copia JSON di profilo, servizi, staff, orari e prenotazioni della tua attività.
                    </p>
                    <button
                      type="button"
                      onClick={exportTenantData}
                      disabled={exporting}
                      className="min-h-[48px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {exporting ? 'Preparazione…' : 'Scarica i miei dati'}
                    </button>
                  </div>
                </div>
              </section>
              
              <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
  {/* HEADER DESKTOP */}
  <div className="hidden border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 md:block">
    <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
      Accesso staff
    </p>
    <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
      Codice attività
    </h2>
  </div>

  {/* HEADER MOBILE */}
  <button
    type="button"
    onClick={() => toggleMobileSection('staff')}
    className="flex w-full items-center justify-between border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 text-left md:hidden"
  >
    <div>
      <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
        Accesso staff
      </p>
      <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
        Codice attività
      </h2>
    </div>

    <span className="text-sm font-black text-slate-400">
      {mobileSections.staff ? '▲' : '▼'}
    </span>
  </button>

  <div className={mobileSections.staff ? 'block' : 'hidden md:block'}>
    <div className="grid gap-3 p-5">
                  <div className="rounded-2xl border border-[#D7EEF0] bg-[#F3FBFB] p-4">
                    <div className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">
                      Codice staff
                    </div>
                    <div className="mt-1 text-3xl font-black tracking-widest text-[#0F1D2D]">
                      {profile.staff_login_code || '—'}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                     Usalo nella pagina login staff insieme a username e password dell’operatore.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        profile.staff_login_code || '',
                        'Codice attività copiato.',
                      )
                    }
                    disabled={!profile.staff_login_code}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6] disabled:opacity-50"
                  >
                    Copia codice
                  </button>
                </div>
                </div>
              </section>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  )
}
