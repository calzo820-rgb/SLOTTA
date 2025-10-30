'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Tenant = {
  id: string
  name: string
  slug: string
  primary_color?: string | null
  logo_url?: string | null
  notification_email?: string | null
  notification_phone?: string | null
}

type TenantSettings = {
  tenant_id: string
  slot_minutes: number
  capacity_per_slot: number
  lead_time_minutes: number
  timezone: string
}

type HourRow = {
  tenant_id: string
  dow: number   // 0=Dom … 6=Sab  (coerente col DB)
  open_time: string
  close_time: string
  is_closed: boolean
}

// Etichette legate al valore dow reale del DB
const DOW_LABELS = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
// Ordine di visualizzazione desiderato: Lunedì → Domenica
const DISPLAY_ORDER = [1,2,3,4,5,6,0]
const TZ_OPTS = ['Europe/Rome','Europe/Berlin','Europe/Paris','UTC']

export default function AdminSettingsPage(){
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')
  const [color, setColor] = useState('#b91c1c')
  const [tab, setTab] = useState<'brand'|'hours'>('brand')

  // BRAND
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [savingBrand, setSavingBrand] = useState(false)

  // HOURS / SETTINGS
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [hours, setHours] = useState<HourRow[]>([])
  const [savingHours, setSavingHours] = useState(false)

  // ===== LOAD TENANTS =====
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id,name,slug,primary_color,logo_url,notification_email,notification_phone')
        .order('name')
      if (error) { alert(error.message); return }
      const list = (data || []) as Tenant[]
      setTenants(list)
      if (list[0]) setTenantId(list[0].id)
    })()
  }, [])

  // ===== LOAD SELECTED TENANT =====
  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      // brand
      const { data: tdata } = await supabase
        .from('tenants')
        .select('id,name,slug,primary_color,logo_url,notification_email,notification_phone')
        .eq('id', tenantId).limit(1)
      const t = (tdata || [])[0] as Tenant | undefined
      if (t) {
        setTenant(t)
        setColor(t.primary_color || '#b91c1c')
      }

      // settings generali
      const { data: sdata } = await supabase
        .from('tenant_settings')
        .select('tenant_id,slot_minutes,capacity_per_slot,lead_time_minutes,timezone')
        .eq('tenant_id', tenantId).limit(1)
      const s = (sdata || [])[0] as TenantSettings | undefined
      setSettings(s || {
        tenant_id: tenantId,
        slot_minutes: 10,
        capacity_per_slot: 5,
        lead_time_minutes: 20,
        timezone: 'Europe/Rome'
      })

      // ore settimanali
      const { data: hdata } = await supabase
        .from('tenant_hours')
        .select('tenant_id,dow,open_time,close_time,is_closed')
        .eq('tenant_id', tenantId)
      const existing = (hdata || []) as HourRow[]
      if (existing.length === 7) {
        setHours(existing) // niente sort: l'ordine lo decidiamo a render
      } else {
        // default 18:00-23:00 aperto tutti i giorni
        const def: HourRow[] = Array.from({length:7}, (_, dow) => ({
          tenant_id: tenantId, dow, open_time: '18:00', close_time: '23:00', is_closed: false
        }))
        // unisci eventuali righe esistenti
        existing.forEach(r => { def[r.dow] = r })
        setHours(def)
      }
    })()
  }, [tenantId])

  // ===== BRAND ACTIONS =====
  async function saveBrand(){
    if (!tenant) return
    setSavingBrand(true)
    const { error } = await supabase
      .from('tenants')
      .update({
        name: tenant.name,
        primary_color: tenant.primary_color || null,
        logo_url: tenant.logo_url || null,
        notification_email: tenant.notification_email || null,
        notification_phone: tenant.notification_phone || null
      })
      .eq('id', tenant.id)
    setSavingBrand(false)
    if (error) alert('Errore salvataggio: ' + error.message)
    else alert('Impostazioni aspetto salvate')
  }

  async function uploadLogo(file: File){
    if (!tenant) return
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${tenant.id}/logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (upErr) { alert(upErr.message); return }
      const { data: pub } = supabase.storage.from('logos').getPublicUrl(path)
      const url = pub?.publicUrl || null
      setTenant(prev => prev ? { ...prev, logo_url: url } : prev)
    } catch (e: any) { alert('Upload fallito: ' + (e?.message || e)) }
  }

  // ===== HOURS ACTIONS =====
  async function saveHours(){
    if (!settings || hours.length !== 7) return
    setSavingHours(true)

    const { error: sErr } = await supabase
      .from('tenant_settings')
      .upsert({
        tenant_id: tenantId,
        slot_minutes: settings.slot_minutes,
        capacity_per_slot: settings.capacity_per_slot,
        lead_time_minutes: settings.lead_time_minutes,
        timezone: settings.timezone
      }, { onConflict: 'tenant_id' })
    if (sErr) { setSavingHours(false); alert('Errore impostazioni: ' + sErr.message); return }

    const payload = hours.map(h => ({
      tenant_id: tenantId,
      dow: h.dow,
      open_time: h.open_time,
      close_time: h.close_time,
      is_closed: !!h.is_closed
    }))
    const { error: hErr } = await supabase
      .from('tenant_hours')
      .upsert(payload, { onConflict: 'tenant_id,dow' })
    setSavingHours(false)
    if (hErr) alert('Errore orari: ' + hErr.message)
    else alert('Orari & capienza salvati')
  }

  // ===== ORDINAMENTO VISUALIZZAZIONE (Lun→Dom) =====
  const hoursDisplay = useMemo(() => {
    const byDow: Record<number, HourRow> = {}
    hours.forEach(h => { byDow[h.dow] = h })
    return DISPLAY_ORDER.map(d => byDow[d]).filter(Boolean) as HourRow[]
  }, [hours])

  return (
    <main className="max-w-5xl mx-auto p-4 md:p-6">
      <header className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Impostazioni del locale</h1>
        <div className="flex gap-2">
          <button
            onClick={()=>setTab('brand')}
            className={`btn ${tab==='brand' ? 'text-white' : 'btn-outline'}`}
            style={{ background: tab==='brand' ? color : 'transparent', borderColor: color }}
          >
            Aspetto
          </button>
          <button
            onClick={()=>setTab('hours')}
            className={`btn ${tab==='hours' ? 'text-white' : 'btn-outline'}`}
            style={{ background: tab==='hours' ? color : 'transparent', borderColor: color }}
          >
            Orari & Capienza
          </button>
        </div>
      </header>

      {/* ===== TAB: BRAND ===== */}
      {tab==='brand' && tenant && (
        <section className="grid md:grid-cols-2 gap-6">
          <div className="border rounded p-4 grid gap-3">
            <div className="font-semibold">Dati principali</div>

            <label className="text-sm">Nome locale</label>
            <input
              className="border rounded px-3 py-2"
              value={tenant.name || ''}
              onChange={e=>setTenant(prev => prev ? { ...prev, name: e.target.value } : prev)}
            />

            <label className="text-sm">Slug (sola lettura)</label>
            <input className="border rounded px-3 py-2 bg-zinc-100" value={tenant.slug} readOnly />

            <label className="text-sm">Colore principale</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={tenant.primary_color || '#b91c1c'}
                onChange={e=>{
                  const v = e.target.value
                  setTenant(prev => prev ? { ...prev, primary_color: v } : prev)
                  setColor(v)
                }}
              />
              <input
                className="border rounded px-3 py-2"
                value={tenant.primary_color || ''}
                onChange={e=>setTenant(prev => prev ? { ...prev, primary_color: e.target.value } : prev)}
                placeholder="#b91c1c"
              />
            </div>

            <label className="text-sm">Email notifiche (opz.)</label>
            <input
              className="border rounded px-3 py-2"
              value={tenant.notification_email || ''}
              onChange={e=>setTenant(prev => prev ? { ...prev, notification_email: e.target.value } : prev)}
              placeholder="es. ordini@pizzeria.it"
            />

            <label className="text-sm">Telefono notifiche (opz.)</label>
            <input
              className="border rounded px-3 py-2"
              value={tenant.notification_phone || ''}
              onChange={e=>setTenant(prev => prev ? { ...prev, notification_phone: e.target.value } : prev)}
              placeholder="es. +39 333 1234567"
            />

            <div className="flex gap-2 mt-2">
              <button
                onClick={saveBrand}
                className="btn text-white"
                style={{ background: color }}
                disabled={savingBrand}
              >
                {savingBrand ? 'Salvataggio…' : 'Salva aspetto'}
              </button>
            </div>
          </div>

          <div className="border rounded p-4 grid place-items-center">
            <div className="grid gap-2 place-items-center">
              {tenant.logo_url ? (
                <img src={tenant.logo_url} alt="Logo" className="max-h-40 object-contain" />
              ) : (
                <div className="text-sm text-zinc-500">Nessun logo</div>
              )}
              <label className="btn btn-outline cursor-pointer" style={{ borderColor: color }}>
                Carica logo
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={e=>{
                    const f = e.target.files?.[0]
                    if (f) uploadLogo(f)
                    e.currentTarget.value = ''
                  }}
                />
              </label>
            </div>
          </div>
        </section>
      )}

      {/* ===== TAB: HOURS ===== */}
      {tab==='hours' && settings && hoursDisplay.length === 7 && (
        <section className="grid gap-6">
          <article className="border rounded p-4 grid md:grid-cols-4 gap-3">
            <div className="font-semibold md:col-span-4">Impostazioni generali</div>

            <div>
              <label className="text-sm">Minuti per slot</label>
              <input
                type="number" min={5} step={5}
                className="border rounded px-3 py-2 w-full"
                value={settings.slot_minutes}
                onChange={e=>setSettings(prev => prev ? { ...prev, slot_minutes: parseInt(e.target.value || '10') } : prev)}
              />
            </div>

            <div>
              <label className="text-sm">Capienza per slot</label>
              <input
                type="number" min={1}
                className="border rounded px-3 py-2 w-full"
                value={settings.capacity_per_slot}
                onChange={e=>setSettings(prev => prev ? { ...prev, capacity_per_slot: parseInt(e.target.value || '5') } : prev)}
              />
            </div>

            <div>
              <label className="text-sm">Lead time (min)</label>
              <input
                type="number" min={0}
                className="border rounded px-3 py-2 w-full"
                value={settings.lead_time_minutes}
                onChange={e=>setSettings(prev => prev ? { ...prev, lead_time_minutes: parseInt(e.target.value || '20') } : prev)}
              />
            </div>

            <div>
              <label className="text-sm">Timezone</label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={settings.timezone}
                onChange={e=>setSettings(prev => prev ? { ...prev, timezone: e.target.value } : prev)}
              >
                {TZ_OPTS.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </article>

          <article className="border rounded p-4">
            <div className="font-semibold mb-3">Orari settimanali</div>
            <div className="grid md:grid-cols-7 gap-3">
              {hoursDisplay.map((h) => (
                <div key={h.dow} className="border rounded p-2">
                  <div className="font-medium mb-1">{DOW_LABELS[h.dow]}</div>

                  <label className="flex items-center gap-2 text-sm mb-2">
                    <input
                      type="checkbox"
                      checked={h.is_closed}
                      onChange={e=>{
                        const v = e.target.checked
                        setHours(prev => prev.map(x => x.dow === h.dow ? { ...x, is_closed: v } : x))
                      }}
                    />
                    Chiuso
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-zinc-600">Apre</div>
                      <input
                        className="border rounded px-2 py-1 w-full"
                        value={h.open_time}
                        onChange={e=>setHours(prev => prev.map(x => x.dow === h.dow ? { ...x, open_time: e.target.value } : x))}
                        placeholder="18:00"
                        disabled={h.is_closed}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-zinc-600">Chiude</div>
                      <input
                        className="border rounded px-2 py-1 w-full"
                        value={h.close_time}
                        onChange={e=>setHours(prev => prev.map(x => x.dow === h.dow ? { ...x, close_time: e.target.value } : x))}
                        placeholder="23:00"
                        disabled={h.is_closed}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <button
                onClick={saveHours}
                className="btn text-white"
                style={{ background: color }}
                disabled={savingHours}
              >
                {savingHours ? 'Salvataggio…' : 'Salva orari & capienza'}
              </button>
            </div>
          </article>
        </section>
      )}

      {/* Selettore locale */}
      <div className="mt-6 flex items-center gap-3">
        <label className="text-sm">Locale</label>
        <select
          value={tenantId}
          onChange={e => setTenantId(e.target.value)}
          className="border rounded px-3 py-2"
        >
          {tenants.map(t => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.slug})
            </option>
          ))}
        </select>
      </div>

      <style jsx global>{`
        .btn {
          border-radius: 0.5rem;
          padding: 0.5rem 0.8rem;
          font-weight: 600;
          transition: transform .06s ease, box-shadow .15s ease, opacity .15s ease;
        }
        .btn:active { transform: translateY(1px); }
        .btn-outline {
          background: white;
          color: inherit;
          border: 2px solid currentColor;
        }
      `}</style>
    </main>
  )
}
