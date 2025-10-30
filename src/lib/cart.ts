'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CartAddon = { id: string; name: string; price_cents: number }
export type CartItem = {
  lineKey: string          // chiave di riga (prodotto + modifiche)
  product_id: string
  name: string
  price_cents: number      // prezzo base pizza (cent)
  qty: number
  removes: string[]        // es. ['mozzarella','basilico']
  adds: CartAddon[]        // es. [{id:'funghi',name:'Funghi',price_cents:50}]
  image_url?: string
}

type AddPayload = {
  product_id: string
  name: string
  price_cents: number
  removes: string[]
  adds: CartAddon[]
  image_url?: string
}

type CartState = {
  items: CartItem[]
  addItem: (p: AddPayload) => void
  inc: (lineKey: string) => void
  dec: (lineKey: string) => void
  remove: (lineKey: string) => void
  clear: () => void
  totalCents: () => number
}

function lineKeyOf(p: AddPayload) {
  const r = [...(p.removes || [])].sort().join(',')
  const a = [...(p.adds || [])].map(x => x.id).sort().join(',')
  // stessa pizza + stesse modifiche => stessa riga
  return `${p.product_id}__rm:${r}__add:${a}`
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (p) => {
        const key = lineKeyOf(p)
        const items = get().items.slice()
        const idx = items.findIndex(i => i.lineKey === key)
        if (idx >= 0) {
          items[idx].qty += 1
        } else {
          items.push({
            lineKey: key,
            product_id: p.product_id,
            name: p.name,
            price_cents: p.price_cents,
            qty: 1,
            removes: p.removes || [],
            adds: p.adds || [],
            image_url: p.image_url,
          })
        }
        set({ items })
      },

      inc: (key) => {
        set(({ items }) => ({
          items: items.map(i => i.lineKey === key ? { ...i, qty: i.qty + 1 } : i)
        }))
      },

      dec: (key) => {
        set(({ items }) => ({
          items: items
            .map(i => i.lineKey === key ? { ...i, qty: i.qty - 1 } : i)
            .filter(i => i.qty > 0)
        }))
      },

      remove: (key) => set(({ items }) => ({ items: items.filter(i => i.lineKey !== key) })),
      clear: () => set({ items: [] }),

      totalCents: () => {
        const { items } = get()
        return items.reduce((sum, i) => {
          const extras = i.adds.reduce((s, a) => s + (a.price_cents || 0), 0)
          return sum + (i.price_cents + extras) * i.qty
        }, 0)
      },
    }),
    { name: 'cart-v1' }
  )
)
