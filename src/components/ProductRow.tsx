'use client'
import React, { useMemo, useState } from 'react'

type Addon = { id: string | number; name: string; price_cents?: number }
type Product = {
  id: string
  name: string
  price_cents: number
  image_url?: string | null
  // può essere array o stringa "Pomodoro | Mozzarella"
  ingredients?: string[] | string | null
}

type Props =
  | {
      p: Product
      addons: Addon[]
      ingredientCatalog?: string[]
      color: string
      product?: never
    }
  | {
      product: Product
      addons: Addon[]
      ingredientCatalog?: string[]
      color: string
      p?: never
    }

function splitBaseIngredients(raw: Product['ingredients']): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === 'string') {
    return raw
      .split(/[|,]/g)
      .map(s => s.trim())
      .filter(Boolean)
  }
  return []
}

export default function ProductRow(props: Props) {
  const product: Product = (props as any).p ?? (props as any).product
  const { addons, ingredientCatalog = [], color } = props as {
    addons: Addon[]
    ingredientCatalog?: string[]
    color: string
  }

  // ---- baseIngredients PRIMA degli state che li usano
  const baseIngredients = useMemo(
    () => splitBaseIngredients(product?.ingredients),
    [product]
  )

  // selezione checkbox: di default = ingredienti base
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(baseIngredients)
  )

  // modale
  const [isModalOpen, setIsModalOpen] = useState(false)
  function openModal() {
    setSelected(new Set(baseIngredients)) // reset
    setIsModalOpen(true)
  }
  function closeModal() { setIsModalOpen(false) }

  // util per euro
  const euro = (c: number) => (c / 100).toFixed(2).replace('.', ',')

  // Aggiungi standard (solo base)
  function addStandard() {
    // qui puoi sostituire con il tuo hook del carrello
    window.dispatchEvent(
      new CustomEvent('cart:add', {
        detail: {
          product_id: product.id,
          name: product.name,
          base_price_cents: product.price_cents,
          adds: [],
          removes: [],
        },
      })
    )
  }

  // Aggiungi con modifiche (checkbox)
  function addWithChanges() {
    const base = new Set(baseIngredients)
    const now = new Set(selected)
    const removed = [...base].filter(x => !now.has(x))
    const addedNames = [...now].filter(x => !base.has(x))

    // mappa gli added alle entry “addon” se esistono
    const addObjs = addedNames.map(name => {
      const found = addons.find(a => a.name.toLowerCase() === name.toLowerCase())
      return {
        id: found?.id ?? name,
        name,
        price_cents: found?.price_cents ?? 0,
      }
    })

    window.dispatchEvent(
      new CustomEvent('cart:add', {
        detail: {
          product_id: product.id,
          name: product.name,
          base_price_cents: product.price_cents,
          adds: addObjs,
          removes: removed,
        },
      })
    )
    closeModal()
  }

  // lista ingredienti mostrati nella modale (catalogo + base)
  const allIngredientNames = useMemo(
    () => Array.from(new Set([...(ingredientCatalog || []), ...baseIngredients])),
    [ingredientCatalog, baseIngredients]
  )

  return (
    <article className="border rounded p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{product.name}</div>
          <div className="text-xs text-zinc-500 truncate">
            {baseIngredients.join(' | ')}
          </div>
        </div>
        <div className="shrink-0 text-sm text-zinc-600">€ {euro(product.price_cents)}</div>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          onClick={openModal}
          className="btn btn-outline"
          style={{ borderColor: color }}
        >
          Modifica
        </button>
        <button
          onClick={addStandard}
          className="btn text-white"
          style={{ background: color }}
        >
          + Aggiungi
        </button>
      </div>

      {/* Modale con checkbox unificate */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <div className="bg-white rounded-xl p-4 w-[min(96vw,560px)]">
            <div className="text-lg font-semibold mb-2">Modifica — {product.name}</div>

            <div className="grid gap-3">
              <div className="text-sm font-medium">Ingredienti</div>
              <div className="grid gap-2 max-h-[50vh] overflow-auto pr-1">
                {allIngredientNames.map(name => {
                  const checked = selected.has(name)
                  return (
                    <label key={name} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelected(prev => {
                            const copy = new Set(prev)
                            if (e.target.checked) copy.add(name)
                            else copy.delete(name)
                            return copy
                          })
                        }
                      />
                      <span className="text-sm">
                        {name}
                        {/* mostra prezzo se è un addon a pagamento */}
                        {(!baseIngredients.includes(name)) && (() => {
                          const a = addons.find(
                            x => x.name.toLowerCase() === name.toLowerCase()
                          )
                          return a && a.price_cents
                            ? ` (+€ ${euro(a.price_cents)})`
                            : ''
                        })()}
                      </span>
                    </label>
                  )
                })}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  className="btn btn-outline"
                  style={{ borderColor: color }}
                  onClick={closeModal}
                >
                  Annulla
                </button>
                <button
                  className="btn text-white"
                  style={{ background: color }}
                  onClick={addWithChanges}
                >
                  Aggiungi (con modifiche)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
