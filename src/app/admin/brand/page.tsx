'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Tenant = { id: string; slug: string; name: string; primary_color: string; logo_url: string | null }

export default function BrandPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selected, setSelected] = useState<string>('') // tenant id
  const [color, setColor] = useState<string>('#E63946')
  const [preview, setPreview] = useState<string>('') // anteprima logo
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('tenants').select('*').order('name', { ascending: true })
      setTenants((data as Tenant[]) || [])
      if (data && data.length) {
        setSelected(data[0].id)
        setColor(data[0].primary_color || '#E63946')
        setPreview(data[0].logo_url || '')
      }
    })()
  }, [])

  function onPickTenant(id: string) {
    setSelected(id)
    const t = tenants.find(x => x.id === id)
    if (t) {
      setColor(t.primary_color || '#E63946')
      setPreview(t.logo_url || '')
      setFile(null)
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null
    setFile(f || null)
    if (f) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    }
  }

  async function save() {
    if (!selected) return
    let logo_url: string | null | undefined = undefined

    // 1) upload logo (se scelto)
    if (file) {
      const tenant = tenants.find(t => t.id === selected)!
      const ext = file.name.split('.').pop() || 'png'
      const path = `tenants/${tenant.slug}-${Date.now()}.${ext}`

      const up = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (up.error) {
        alert('Errore upload logo: ' + up.error.message)
        return
      }
      // ottieni URL pubblico
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      logo_url = data.publicUrl
    }

    // 2) aggiorna colore/logo su tenants
    const payload: any = { primary_color: color }
    if (logo_url !== undefined) payload.logo_url = logo_url

    const { error } = await supabase.from('tenants').update(payload).eq('id', selected)
    if (error) {
      alert('Errore salvataggio: ' + error.message)
      return
    }

    alert('Brand salvato!')
  }

  return (
    <main className="max-w-3xl mx-auto p-6 grid gap-4">
      <h1 className="text-2xl font-bold">Brand locale (logo + colore)</h1>

      <label className="grid gap-2">
        <span className="text-sm">Seleziona locale</span>
        <select value={selected} onChange={e => onPickTenant(e.target.value)} className="border rounded px-3 py-2">
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
        </select>
      </label>

      <div className="grid md:grid-cols-2 gap-6">
        <label className="grid gap-2">
          <span className="text-sm">Colore principale</span>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-16 h-10 p-0 border rounded" />
          <div className="text-sm text-zinc-600">Usato per pulsanti e titoli.</div>
        </label>

        <label className="grid gap-2">
          <span className="text-sm">Logo (PNG/JPG/SVG)</span>
          <input type="file" accept="image/*" onChange={onPickFile} />
          {preview && (
            <div className="border rounded p-3">
              <img src={preview} alt="Anteprima logo" className="max-h-20 object-contain" />
            </div>
          )}
        </label>
      </div>

      <button onClick={save} className="px-4 py-2 rounded text-white" style={{ background: color }}>
        Salva brand
      </button>
    </main>
  )
}
