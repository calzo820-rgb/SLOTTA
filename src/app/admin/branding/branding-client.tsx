'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Tenant = {
  id: string
  name: string
  slug: string
  tenant_mode?: 'service' | 'pizza' | string
  logo_url?: string | null
  address?: string | null
  primary_color?: string | null
  secondary_color?: string | null
}
const BUCKET = 'tenant-assets'

async function uploadTenantAsset(file: File, tenantId: string) {
  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = `${tenantId}/${fileName}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })
  if (upErr) throw upErr

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** UI helpers */
function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="border rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-zinc-50">
        <div className="font-semibold">{title}</div>
        {subtitle ? <div className="text-sm text-zinc-600">{subtitle}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  )
}

function ImagePicker({
  label,
  help,
  valueUrl,
  previewUrl,
  onPick,
  onClear,
}: {
  label: string
  help?: string
  valueUrl?: string | null
  previewUrl?: string | null
  onPick: (file: File) => void
  onClear?: () => void
}) {
  const shown = previewUrl || valueUrl || null

  return (
    <div className="grid gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{label}</div>
          {help ? <div className="text-xs text-zinc-500">{help}</div> : null}
        </div>

        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs px-3 py-2 rounded-xl border hover:bg-zinc-50"
          >
            Rimuovi
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <div className="h-16 w-16 rounded-2xl border bg-white overflow-hidden grid place-items-center">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt={label} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] text-zinc-400">Nessuna</span>
          )}
        </div>

        <label
          className={[
            'inline-flex items-center justify-center',
            'px-4 py-2 rounded-xl border text-sm font-medium',
            'bg-white shadow-sm',
            'transition-all duration-200 ease-out',
            'hover:-translate-y-[1px] hover:shadow-md hover:border-zinc-400 hover:ring-2 hover:ring-zinc-200 hover:ring-offset-1',
            'active:translate-y-0 active:shadow-sm',
            'cursor-pointer select-none',
          ].join(' ')}
        >
          <span className="mr-2">🖼️</span>
          Inserisci immagine
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (!f) return
              onPick(f)
              e.currentTarget.value = ''
            }}
          />
        </label>
      </div>
    </div>
  )
}

/** STAFF MANAGER (owner only UI) */
function StaffManager({ tenantId }: { tenantId: string }) {
  const PAGES = [
    { key: 'services', label: 'Servizi' },
    { key: 'bookings', label: 'Prenotazioni' },
    { key: 'calendar', label: 'Calendario' },
    { key: 'hours', label: 'Orari & capacità' },
  ] as const

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [allowedPages, setAllowedPages] = useState<string[]>(['services'])

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function togglePage(key: string) {
    setAllowedPages(prev =>
      prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key],
    )
  }

  async function createStaff() {
    setSaving(true)
    setErr(null)
    setMsg(null)

    try {
      const res = await fetch('/api/admin/staff/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          username,
          password,
          allowed_pages: allowedPages,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Errore creazione staff')

      setMsg(`Staff creato ✅ Username: ${data.username}`)
      setUsername('')
      setPassword('')
      setAllowedPages(['services'])
    } catch (e: any) {
      setErr(e?.message || 'Errore')
    } finally {
      setSaving(false)
    }
  }

  const canCreate =
    username.trim().length >= 3 && password.trim().length >= 6 && allowedPages.length > 0 && !saving

  return (
    <div className="grid gap-4">
      <div>
        <div className="text-sm font-semibold">Crea utente staff</div>
        <div className="text-xs text-zinc-500">
          Lo staff accede con username + password. Le impostazioni restano solo per il gestore.
        </div>
      </div>

      {err ? (
        <div className="text-sm text-red-700 border rounded-xl p-3 bg-red-50">{err}</div>
      ) : null}
      {msg ? <div className="text-sm border rounded-xl p-3 bg-white">{msg}</div> : null}

      <div className="grid md:grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">Username</span>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="border rounded-xl px-3 py-2"
            placeholder="es. marco"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="text-[11px] text-zinc-500">Minimo 3 caratteri.</span>
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">Password</span>
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="border rounded-xl px-3 py-2"
            placeholder="min 6 caratteri"
            type="password"
          />
          <span className="text-[11px] text-zinc-500">Minimo 6 caratteri.</span>
        </label>
      </div>

      <div className="grid gap-2">
        <div className="text-xs text-zinc-500">Pagine accessibili</div>
        <div className="flex flex-wrap gap-2">
          {PAGES.map(p => {
            const checked = allowedPages.includes(p.key)
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => togglePage(p.key)}
                className={[
                  'px-3 py-2 rounded-xl border text-sm transition',
                  checked
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white hover:bg-zinc-50',
                ].join(' ')}
              >
                {checked ? '✅ ' : ''}{p.label}
              </button>
            )
          })}
        </div>
        <div className="text-[11px] text-zinc-500">
          Nota: “Impostazioni” non è selezionabile (solo gestore).
        </div>
      </div>

      <button
        type="button"
        onClick={createStaff}
        disabled={!canCreate}
        className="px-4 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed w-fit"
      >
        {saving ? 'Creazione…' : 'Crea utente staff'}
      </button>
    </div>
  )
}

export default function BrandingClient() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [tenantId, settenantId] = useState('')

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#b91c1c')
  const [secondaryColor, setSecondaryColor] = useState('#111827')

  const [logoFile, setLogoFile] = useState<File | null>(null)

  const [removeLogo, setRemoveLogo] = useState(false)

  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // cleanup preview blob
  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
          }
  }, [logoPreview])

  // carica il tenant "service" (primo) e lo usa come default
  useEffect(() => {
    ;(async () => {
      setError(null)
      setMsg(null)

      const { data, error } = await supabase
        .from('tenants')
        .select('id,name,slug,tenant_mode,logo_url,address,primary_color,secondary_color')
        .eq('tenant_mode', 'service')
        .order('name')
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error(error)
        setError(error.message)
        return
      }

      if (!data) {
        setError('Nessun salone trovato (tenant_mode = service).')
        return
      }

      const t = data as Tenant
      settenantId(t.id)
      setTenant(t)

      setName(t.name || '')
      setAddress(t.address || '')
      setPrimaryColor(t.primary_color || '#b91c1c')
      setSecondaryColor(t.secondary_color || '#111827')

      setRemoveLogo(false)
      setLogoFile(null)
      setLogoPreview(null)
      })()
  }, [])

const dirty = useMemo(() => {
  if (!tenant) return false
  return (
    name.trim() !== (tenant.name || '').trim() ||
    address.trim() !== (tenant.address || '').trim() ||
    primaryColor !== (tenant.primary_color || '#b91c1c') ||
    secondaryColor !== (tenant.secondary_color || '#111827') ||
    !!logoFile ||
    removeLogo
  )
}, [tenant, name, address, primaryColor, secondaryColor, logoFile, removeLogo])

  async function save() {
    if (!tenantId) return
    setSaving(true)
    setMsg(null)
    setError(null)

    try {
      let logo_url: string | null = removeLogo ? null : (tenant?.logo_url ?? null)
      if (logoFile) logo_url = await uploadTenantAsset(logoFile, tenantId)
      
      const { error } = await supabase
        .from('tenants')
        .update({
  name: name.trim(),
  address: address.trim() || null,
  logo_url,
  primary_color: primaryColor,
  secondary_color: secondaryColor,
})
        .eq('id', tenantId)

      if (error) throw error

      setTenant(prev =>
  prev
    ? {
        ...prev,
        name: name.trim(),
        address: address.trim() || null,
        logo_url,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      }
    : prev,
)

      setLogoFile(null)
      setLogoPreview(null)
      setRemoveLogo(false)

      setMsg('Salvato ✅')
    } catch (e: any) {
      console.error(e)
      setError(e?.message || 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-6 grid gap-4">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Impostazioni salone</h1>
          <p className="text-sm text-zinc-600">
            Personalizza nome, colori e logo mostrati nella pagina di prenotazione.
          </p>
          {tenant ? (
            <p className="text-xs text-zinc-500 mt-1">
              Locale: <span className="font-medium text-zinc-700">{tenant.name}</span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-500">
            {saving ? 'Salvataggio…' : dirty ? 'Modifiche non salvate' : 'Tutto salvato'}
          </div>
          <button
            onClick={save}
            disabled={saving || !tenantId || !dirty}
            className="px-4 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-50"
          >
            {saving ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </div>

      {/* MSG/ERROR */}
      {error ? (
        <div className="text-sm text-red-700 border rounded-xl p-3 bg-red-50">{error}</div>
      ) : null}
      {msg ? <div className="text-sm border rounded-xl p-3 bg-white">{msg}</div> : null}

      {/* CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Identità" subtitle="Nome e colori del salone.">
          <div className="grid gap-4">
            <Field label="Nome salone">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="border rounded-xl px-3 py-2"
              />
            </Field>
<Field label="Indirizzo salone">
  <input
    value={address}
    onChange={e => setAddress(e.target.value)}
    className="border rounded-xl px-3 py-2"
    placeholder="Es. Via Roma 12, Milano"
  />
</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Colore primario">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="border rounded-xl h-11 w-16 px-2"
                  />
                  <input
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="border rounded-xl px-3 py-2 w-full"
                  />
                </div>
              </Field>

              <Field label="Colore secondario">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={e => setSecondaryColor(e.target.value)}
                    className="border rounded-xl h-11 w-16 px-2"
                  />
                  <input
                    value={secondaryColor}
                    onChange={e => setSecondaryColor(e.target.value)}
                    className="border rounded-xl px-3 py-2 w-full"
                  />
                </div>
              </Field>
            </div>
          </div>
        </Card>

       <Card title="Logo salone" subtitle="Questo logo verrà mostrato ai clienti nella pagina di prenotazione.">
  <div className="grid gap-6">
    <ImagePicker
  label="Logo"
  help="Consigliato formato quadrato. Verrà mostrato nella pagina cliente."
      valueUrl={tenant?.logo_url}
      previewUrl={logoPreview}
      onPick={file => {
        if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
        setLogoFile(file)
        setLogoPreview(URL.createObjectURL(file))
        setRemoveLogo(false)
      }}
      onClear={
        logoFile || tenant?.logo_url
          ? () => {
              setLogoFile(null)
              if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
              setLogoPreview(null)
              setRemoveLogo(true)
            }
          : undefined
      }
    />
  </div>
</Card>
      </div>
    </main>
  )
}
