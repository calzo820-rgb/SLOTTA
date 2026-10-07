'use client'

import { useEffect, useState } from 'react'

export type MunicipalityOption = {
  code_istat: string
  name: string
  province_code: string | null
  province_name: string
  region_name: string
}

type Props = {
  value: string
  selectedCode: string | null
  onSelect: (municipality: MunicipalityOption | null) => void
}

export default function MunicipalityPicker({ value, selectedCode, onSelect }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<MunicipalityOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)


  useEffect(() => {
    const search = query.trim()
    if (search.length < 2 || (selectedCode && search === value)) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/public/municipalities?q=${encodeURIComponent(search)}`, {
          cache: 'no-store',
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error || 'Municipality search failed')
        if (cancelled) return
        setResults((payload?.municipalities || []) as MunicipalityOption[])
      } catch {
        if (cancelled) return
        setError('Impossibile caricare l’elenco dei comuni.')
        setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [query, selectedCode, value])

  return (
    <div className="relative grid gap-1">
      <label htmlFor="tenant-municipality" className="text-sm font-bold text-[#0F1D2D]">
        Comune
      </label>
      <input
        id="tenant-municipality"
        value={query}
        onChange={event => {
          setQuery(event.target.value)
          if (selectedCode) onSelect(null)
        }}
        autoComplete="address-level2"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={results.length > 0}
        aria-controls="tenant-municipality-options"
        className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
        placeholder="Digita almeno 2 lettere"
        required
      />
      {loading ? <span className="text-xs text-slate-500">Ricerca comuni…</span> : null}
      {error ? <span role="alert" className="text-xs text-red-600">{error}</span> : null}
      {results.length ? (
        <ul id="tenant-municipality-options" role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
          {results.map(municipality => (
            <li key={municipality.code_istat} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => {
                  onSelect(municipality)
                  setQuery(municipality.name)
                  setResults([])
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-teal-50"
              >
                <span className="font-bold">{municipality.name}</span>
                <span className="ml-2 text-slate-500">{municipality.province_code ? `(${municipality.province_code}) · ` : ""}{municipality.province_name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
