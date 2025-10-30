'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useCart } from '@/lib/cart'

/* ---------- util ---------- */
const CURRENCY = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const euro = (cents: number) => CURRENCY.format(Math.max(0, Math.round(cents)) / 100)

type ApiSlot = { iso: string; label: string; available: boolean }
type UiSlot  = { start: string; label: string; can_select: boolean }

/** Normalizza “removed”/“removes”/“remove_ids” in string[] */
function getRemoved(i: any): string[] {
  const raw =
    i?.removed ??
    i?.removes ??
    i?.removedIngredients ??
    i?.remove_ids ??
    []

  const arr = Array.isArray(raw) ? raw : []
  return arr
    .map((r) => {
      if (typeof r === 'string') return r
      if (r && typeof r === 'object') return r.name ?? r.label ?? r.title ?? ''
      return ''
    })
    .filter(Boolean)
}

function hhmmFromISO(iso: string) {
  try {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return iso }
}

/* ===================================================== */

export default function CartPanel({
  tenantSlug,
  color = '#8b0000',
}: {
  tenantSlug: string
  color?: string
}) {
  // stato cart
  const { items, inc, dec, remove, clear, totalCents: totalFromStore } = useCart()

  // hydration guard (evita mismatch SSR/CSR)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // totale sicuro
  const total = useMemo(() => (mounted ? totalFromStore() : 0), [mounted, items, totalFromStore])

  // fasce orarie
  const [slots, setSlots] = useState<UiSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlotISO, setSelectedSlotISO] = useState<string | null>(null)

  // carica sempre le fasce dal tuo endpoint /api/availability?slug=...
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (!tenantSlug) return
        setLoadingSlots(true)
        const res = await fetch(`/api/availability?slug=${encodeURIComponent(tenantSlug)}`, {
          cache: 'no-store',
        })
        const data = await res.json()
        const apiSlots: ApiSlot[] = Array.isArray(data?.slots) ? data.slots : []
        const ui: UiSlot[] = apiSlots.map(s => ({
          start: s.iso,
          label: s.label,
          can_select: !!s.available,
        }))
        if (!alive) return
        setSlots(ui)

        // mantieni selezione valida o rimuovila
        if (selectedSlotISO && !ui.some(s => s.start === selectedSlotISO && s.can_select)) {
          setSelectedSlotISO(null)
        }
        // se nulla è selezionato, scegli il primo disponibile
        if (!selectedSlotISO) {
          const first = ui.find(s => s.can_select)
          if (first) setSelectedSlotISO(first.start)
        }
      } catch (e) {
        console.error('availability error', e)
        if (alive) setSlots([])
      } finally {
        if (alive) setLoadingSlots(false)
      }
    })()
    return () => { alive = false }
  }, [tenantSlug]) // ricarica cambiando locale

  /* ---------- checkout ---------- */
  async function goToCheckout() {
    if (!mounted) return
    if (!selectedSlotISO || items.length === 0) return

    try {
      const payload = {
        tenant_slug: tenantSlug,
        slot_iso: selectedSlotISO,
        items: items.map((i: any) => ({
          product_id: i.product_id,
          qty: i.qty,
          // il server ricrea il totale partendo dal prezzo base + adds
          price_cents: i.price_cents ?? i.base_price_cents ?? 0,
          addons: (i.adds || i.addons || []).map((a: any) => ({
            id: a.id,
            name: a.name,
            price_cents: a.price_cents || 0,
          })),
          removed: getRemoved(i),
        })),
        channel: 'web',
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const out = await res.json()

      if (!res.ok) {
        alert(out?.error || 'Errore checkout')
        return
      }
      if (out?.url) {
        window.location.href = out.url
      } else {
        alert('Risposta checkout non valida.')
      }
    } catch (err: any) {
      console.error(err)
      alert('Errore invio ordine')
    }
  }

  /* ===================================================== */

  return (
    <aside className="rounded-lg border p-4 bg-white">
      <div className="text-lg font-semibold mb-2">Il tuo ordine</div>

      {/* RIGHE CARRELLO */}
      <ul className="space-y-2">
        {items.map((i: any) => {
          const lineKey = i.lineKey ?? `${i.product_id}-${i._uid ?? ''}`
          const adds = i.adds || i.addons || []
          const extras = adds.reduce((s: number, a: any) => s + (a.price_cents || 0), 0)
          const unit = (i.price_cents ?? i.base_price_cents ?? 0) + extras
          const removed = getRemoved(i)

          return (
            <li key={lineKey} className="rounded border p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {i.name}{' '}
                    <span className="text-zinc-500" suppressHydrationWarning>
                      × {mounted ? i.qty : 0}
                    </span>
                  </div>

                  {/* Rimozioni (rosso) */}
                  {removed.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {removed.map((name: string, idx: number) => (
                        <span
                          key={`rm-${lineKey}-${idx}-${name}`}
                          className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200"
                          title={`Rimosso: ${name}`}
                        >
                          − {name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Aggiunte (verde) */}
                  {adds.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {adds.map((a: any) => (
                        <span
                          key={`${lineKey}-add-${a.id ?? a.name}`}
                          className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-300"
                          title={a.name}
                        >
                          + {a.name}
                          {a.price_cents ? ` (+${euro(a.price_cents)})` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-sm text-zinc-600" suppressHydrationWarning>
                    {mounted ? euro(unit) : euro(0)}
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-1">
                    <button
                      className="h-7 w-7 rounded border"
                      aria-label="Diminuisci"
                      onClick={() => mounted && dec(lineKey)}
                      disabled={!mounted}
                    >
                      −
                    </button>
                    <button
                      className="h-7 w-7 rounded border"
                      aria-label="Aumenta"
                      onClick={() => mounted && inc(lineKey)}
                      disabled={!mounted}
                    >
                      +
                    </button>
                    <button
                      className="ml-1 text-xs text-red-600"
                      onClick={() => mounted && remove(lineKey)}
                      disabled={!mounted}
                    >
                      Rimuovi
                    </button>
                  </div>
                </div>
              </div>
            </li>
          )
        })}

        {items.length === 0 && (
          <li className="text-sm text-zinc-500">Nessun prodotto nel carrello.</li>
        )}
      </ul>

      {/* FASCE ORARIE */}
      <div className="mt-4 border-t pt-3">
        <div className="text-sm font-medium mb-2">Fascia di ritiro</div>
        {loadingSlots ? (
          <div className="text-sm text-zinc-500">Caricamento orari…</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.length === 0 && (
              <span className="text-sm text-zinc-500">Nessuna fascia configurata.</span>
            )}
            {slots.map((s, idx) => {
              const id = `sl-${idx}-${s.start}`
              const isSel = s.start === selectedSlotISO
              const disabled = !s.can_select
              return (
                <button
                  key={id}
                  onClick={() => !disabled && setSelectedSlotISO(s.start)}
                  className={`px-3 py-1 rounded border text-sm ${
                    isSel ? 'text-white' : disabled ? 'text-zinc-400' : 'text-black'
                  }`}
                  style={{
                    background: isSel ? color : disabled ? '#f1f1f1' : 'transparent',
                    borderColor: isSel ? color : '#ccc',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.6 : 1,
                  }}
                  disabled={disabled}
                  title={disabled ? 'Slot non disponibile' : `Ritiro ${hhmmFromISO(s.start)}`}
                >
                  {s.label || hhmmFromISO(s.start)}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Totale + CTA */}
      <div className="mt-4 border-t pt-3 flex items-center justify-between">
        <div className="text-sm text-zinc-600">Totale</div>
        <div className="text-lg font-semibold" suppressHydrationWarning>
          {euro(total)}
        </div>
      </div>

      <button
        onClick={goToCheckout}
        disabled={!mounted || !selectedSlotISO || items.length === 0}
        className="mt-3 w-full rounded px-4 py-2 text-white disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: color }}
      >
        Vai al pagamento
      </button>

      {items.length > 0 && (
        <button
          onClick={() => mounted && clear()}
          className="mt-2 w-full rounded px-4 py-2 text-sm border"
          disabled={!mounted}
        >
          Svuota carrello
        </button>
      )}
    </aside>
  )
}
