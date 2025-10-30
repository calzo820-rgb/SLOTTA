'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Tenant = {
  id: string
  name: string
  slug: string
  primary_color?: string | null
  logo_url?: string | null
}

type Product = {
  id: string
  tenant_id: string
  name: string
  ingredients: string | null
  description: string | null
  price_cents: number
  position: number
  is_active: boolean
  image_url: string | null
}

function euroToCents(v: string) {
  // accetta "7", "7,00", "7.00"
  const n = v.replace(',', '.')
  const f = parseFloat(n)
  return Number.isFinite(f) ? Math.round(f * 100) : 0
}
function centsToEuro(c: number) {
  return (c / 100).toFixed(2).replace('.', ',')
}

export default function AdminMenuPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState<string>('')
  const [tenantSlug, setTenantSlug] = useState<string>('')
  const [color, setColor] = useState<string>('#b91c1c')

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  // ===== LOAD TENANTS =====
  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id,name,slug,primary_color,logo_url')
        .order('name', { ascending: true })
      if (error) {
        alert('Errore caricamento locali: ' + error.message)
        return
      }
      const list = (data || []) as Tenant[]
      setTenants(list)
      if (list[0]) {
        setTenantId(list[0].id)
        setTenantSlug(list[0].slug)
        setColor(list[0].primary_color || '#b91c1c')
      }
    })()
  }, [])

  // ===== LOAD PRODUCTS FOR TENANT =====
  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      await loadProducts()
      const t = tenants.find(x => x.id === tenantId)
      if (t) {
        setTenantSlug(t.slug)
        setColor(t.primary_color || '#b91c1c')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function loadProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select(
        'id,tenant_id,name,ingredients,description,price_cents,position,is_active,image_url'
      )
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true })
    setLoading(false)
    if (error) {
      alert('Errore caricamento prodotti: ' + error.message)
      return
    }
    setProducts((data || []) as Product[])
  }

  // ===== CREATE =====
  async function addNew() {
    if (!tenantId) {
      alert('Seleziona un locale prima di aggiungere un prodotto')
      return
    }
    const nextPos = (products?.length || 0) + 1
    const { error } = await supabase.from('products').insert({
      tenant_id: tenantId,
      name: 'Nuovo prodotto',
      ingredients: '',
      description: '',
      price_cents: 0,
      position: nextPos,
      is_active: true,
      image_url: null
    })
    if (error) {
      alert('Errore creazione prodotto: ' + error.message)
    } else {
      await loadProducts()
    }
  }

  // ===== UPDATE (SAVE BUTTON) =====
  async function saveOne(p: Product) {
    const { error } = await supabase
      .from('products')
      .update({
        name: p.name,
        ingredients: p.ingredients,
        description: p.description,
        price_cents: p.price_cents,
        position: p.position,
        is_active: p.is_active,
        image_url: p.image_url
      })
      .eq('id', p.id)
    if (error) alert('Errore salvataggio: ' + error.message)
    else await loadProducts()
  }

  // ===== DELETE =====
  async function deleteOne(id: string) {
    if (!confirm('Eliminare definitivamente questo prodotto?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) alert('Errore eliminazione: ' + error.message)
    else setProducts(prev => prev.filter(x => x.id !== id))
  }

  // ===== TOGGLE VISIBILITY (save immediately) =====
  async function toggleVisible(p: Product, next: boolean) {
    setProducts(prev =>
      prev.map(x => (x.id === p.id ? { ...x, is_active: next } : x))
    )
    const { error } = await supabase
      .from('products')
      .update({ is_active: next })
      .eq('id', p.id)
    if (error) {
      alert('Errore aggiornamento visibilità: ' + error.message)
      // rollback
      setProducts(prev =>
        prev.map(x => (x.id === p.id ? { ...x, is_active: !next } : x))
      )
    }
  }

  // ===== IMAGE UPLOAD =====
async function onPickImage(p: Product, file: File) {
  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `product/${p.tenant_id}/${p.id}-${Date.now()}.${ext}`

    // upload nel bucket 'logos'
    const { error: upErr } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true })

    if (upErr) {
      console.error('Upload error:', upErr)
      alert('Errore upload immagine: ' + upErr.message)
      return
    }

    // url pubblico
    const { data: pub } = supabase.storage.from('logos').getPublicUrl(path)
    const url = pub?.publicUrl || null
    if (!url) { alert('Impossibile ottenere URL pubblico'); return }

    // salva nel DB
    const { error: updErr } = await supabase
      .from('products')
      .update({ image_url: url })
      .eq('id', p.id)

    if (updErr) {
      console.error('DB update error:', updErr)
      alert('Errore salvataggio immagine: ' + updErr.message)
      return
    }

    // aggiorna UI
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, image_url: url } : x))
  } catch (e: any) {
    console.error(e)
    alert('Errore upload: ' + (e?.message || e))
  }
}

  // ===== RENDER =====
  return (
    <main className="max-w-5xl mx-auto p-4 md:p-6">
      <header className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Menù — immagini e ingredienti</h1>
        {tenantSlug && (
          <Link
            href={`/t/${tenantSlug}`}
            className="btn btn-outline"
            style={{ borderColor: color }}
          >
            Apri pagina pubblica
          </Link>
        )}
      </header>

      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm">Seleziona locale</label>
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

        <button
          onClick={addNew}
          className="btn text-white ml-auto"
          style={{ background: color }}
        >
          + Aggiungi prodotto
        </button>
      </div>

      {loading && (
        <div className="text-sm text-zinc-600 mb-3">Caricamento…</div>
      )}

      <section className="grid gap-6">
        {products.map(p => (
          <article
            key={p.id}
            className="border rounded p-3 grid md:grid-cols-2 gap-3"
          >
            <div className="grid gap-2">
              <div className="font-semibold">{p.name || 'Prodotto'}</div>

              <input
                value={p.name || ''}
                onChange={e =>
                  setProducts(prev =>
                    prev.map(x =>
                      x.id === p.id ? { ...x, name: e.target.value } : x
                    )
                  )
                }
                placeholder="Nome"
                className="border rounded px-3 py-2"
              />
              <input
                value={p.ingredients || ''}
                onChange={e =>
                  setProducts(prev =>
                    prev.map(x =>
                      x.id === p.id
                        ? { ...x, ingredients: e.target.value }
                        : x
                    )
                  )
                }
                placeholder="Ingredienti (es. Pomodoro | Mozzarella)"
                className="border rounded px-3 py-2"
              />
              <textarea
                value={p.description || ''}
                onChange={e =>
                  setProducts(prev =>
                    prev.map(x =>
                      x.id === p.id
                        ? { ...x, description: e.target.value }
                        : x
                    )
                  )
                }
                placeholder="Descrizione (opzionale)"
                className="border rounded px-3 py-2"
              />

              <div className="grid grid-cols-3 gap-2 items-center">
                <label className="text-sm">Prezzo (€)</label>
                <input
                  value={centsToEuro(p.price_cents)}
                  onChange={e =>
                    setProducts(prev =>
                      prev.map(x =>
                        x.id === p.id
                          ? { ...x, price_cents: euroToCents(e.target.value) }
                          : x
                      )
                    )
                  }
                  className="border rounded px-3 py-2"
                />
                <div />
                <label className="text-sm">Ordine</label>
                <input
                  type="number"
                  value={p.position}
                  onChange={e =>
                    setProducts(prev =>
                      prev.map(x =>
                        x.id === p.id
                          ? { ...x, position: parseInt(e.target.value || '0') }
                          : x
                      )
                    )
                  }
                  className="border rounded px-3 py-2"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.is_active}
                    onChange={e => toggleVisible(p, e.target.checked)}
                  />
                  Visibile
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => saveOne(p)}
                  className="btn btn-outline"
                  style={{ borderColor: color }}
                >
                  Salva
                </button>
                <button
                  onClick={() => deleteOne(p.id)}
                  className="btn btn-outline"
                  style={{ borderColor: '#ef4444', color: '#ef4444' }}
                >
                  Elimina
                </button>
              </div>
            </div>

            <div className="border rounded min-h-[220px] flex flex-col items-center justify-center p-2">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="max-h-56 object-contain"
                />
              ) : (
                <div className="text-sm text-zinc-500">Nessuna immagine</div>
              )}
              <div className="mt-2">
                <label className="btn btn-outline cursor-pointer" style={{ borderColor: color }}>
                  Scegli file
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) onPickImage(p, file)
                      e.currentTarget.value = ''
                    }}
                  />
                </label>
              </div>
            </div>
          </article>
        ))}

        {products.length === 0 && !loading && (
          <div className="text-sm text-zinc-600">
            Nessun prodotto. Clicca “Aggiungi prodotto”.
          </div>
        )}
      </section>

      <style jsx global>{`
        .btn {
          border-radius: 0.5rem;
          padding: 0.5rem 0.8rem;
          font-weight: 600;
          transition: transform 0.06s ease, box-shadow 0.15s ease, opacity 0.15s ease;
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
