'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Tenant = { id: string; name: string; slug: string }
type Row = { id?: string; dow: number; open_time: string; close_time: string; is_closed: boolean }

const DOW = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']

export default function HoursAdmin() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [settings, setSettings] = useState({ slot_minutes: 10, capacity_per_slot: 5, lead_time_minutes: 20, timezone: 'Europe/Rome' })

  useEffect(() => {
    (async () => {
      const t = await supabase.from('tenants').select('id,name,slug').order('name')
      const list = (t.data || []) as Tenant[]
      setTenants(list)
      if (list[0]) setTenantId(list[0].id)
    })()
  }, [])

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      const { data: hh } = await supabase.from('tenant_hours').select('*').eq('tenant_id', tenantId)
      const m = new Map<number, Row>()
      ;(hh || []).forEach((r:any) => m.set(r.dow, r))
      const full: Row[] = Array.from({length:7}, (_,d)=> m.get(d) || { dow:d, open_time:'18:00:00', close_time:'23:00:00', is_closed:false })
      setRows(full)

      const { data: st } = await supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).single()
      if (st) setSettings(st as any); else {
        await supabase.from('tenant_settings').insert({ tenant_id: tenantId })
        const { data: st2 } = await supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).single()
        if (st2) setSettings(st2 as any)
      }
    })()
  }, [tenantId])

  function onField(d:number, field:keyof Row, v:any){
    setRows(prev => prev.map(r => r.dow===d ? { ...r, [field]: v } : r))
  }

  async function save() {
    // upsert settings
    await supabase.from('tenant_settings').upsert({ tenant_id: tenantId, ...settings })
    // upsert hours
    for (const r of rows) {
      await supabase.from('tenant_hours').upsert({ tenant_id: tenantId, ...r, open_time:r.open_time, close_time:r.close_time })
    }
    alert('Salvato!')
  }

  return (
    <main className="max-w-3xl mx-auto p-6 grid gap-4">
      <h1 className="text-2xl font-bold">Orari & capacità</h1>

      <label className="grid gap-1 w-80">
        <span className="text-sm">Seleziona locale</span>
        <select value={tenantId} onChange={e=>setTenantId(e.target.value)} className="border rounded px-3 py-2">
          {tenants.map(t=> <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
        </select>
      </label>

      <div className="grid gap-3">
        <div className="font-semibold">Impostazioni</div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2">Slot (min)
            <input type="number" min={5} step={5} value={settings.slot_minutes}
              onChange={e=>setSettings(s=>({ ...s, slot_minutes:Number(e.target.value||10) }))}
              className="border rounded px-2 py-1 w-24"/>
          </label>
          <label className="flex items-center gap-2">Capienza/slot
            <input type="number" min={1} value={settings.capacity_per_slot}
              onChange={e=>setSettings(s=>({ ...s, capacity_per_slot:Number(e.target.value||5) }))}
              className="border rounded px-2 py-1 w-24"/>
          </label>
          <label className="flex items-center gap-2">Lead time (min)
            <input type="number" min={0} value={settings.lead_time_minutes}
              onChange={e=>setSettings(s=>({ ...s, lead_time_minutes:Number(e.target.value||0) }))}
              className="border rounded px-2 py-1 w-28"/>
          </label>
          <label className="flex items-center gap-2">Timezone
            <input value={settings.timezone}
              onChange={e=>setSettings(s=>({ ...s, timezone:e.target.value }))}
              className="border rounded px-2 py-1 w-44" placeholder="Europe/Rome"/>
          </label>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="font-semibold">Orari settimanali</div>
        <div className="grid gap-2">
          {rows.map(r=>(
            <div key={r.dow} className="border rounded p-2 flex items-center gap-3">
              <div className="w-16">{DOW[r.dow]}</div>
              <label className="flex items-center gap-2">Apre
                <input type="time" value={r.open_time.slice(0,5)} onChange={e=>onField(r.dow,'open_time',e.target.value+':00')} className="border rounded px-2 py-1"/>
              </label>
              <label className="flex items-center gap-2">Chiude
                <input type="time" value={r.close_time.slice(0,5)} onChange={e=>onField(r.dow,'close_time',e.target.value+':00')} className="border rounded px-2 py-1"/>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={r.is_closed} onChange={e=>onField(r.dow,'is_closed',e.target.checked)}/>
                Chiuso
              </label>
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} className="px-4 py-2 rounded bg-black text-white w-40">Salva</button>
    </main>
  )
}
