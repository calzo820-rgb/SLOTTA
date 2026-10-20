'use client'

import { useEffect, useMemo } from 'react'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import type { MarketplaceResult } from '@/lib/marketplaceSearch'

type Props = { items: MarketplaceResult[] }

function FitMarkers({ items }: Props) {
  const map = useMap()
  const bounds = useMemo(
    () => items.flatMap(item => item.latitude != null && item.longitude != null
      ? [[item.latitude, item.longitude] as [number, number]]
      : []),
    [items],
  )

  useEffect(() => {
    if (bounds.length === 1) map.setView(bounds[0], 13)
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 })
  }, [bounds, map])
  return null
}

export default function MarketplaceMap({ items }: Props) {
  const locatedItems = items.filter(
    item => item.latitude != null && item.longitude != null,
  )

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="h-[min(68vh,620px)] min-h-[360px] w-full" aria-label="Mappa delle attività trovate">
        <MapContainer
          center={[42.5, 12.5]}
          zoom={6}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitMarkers items={locatedItems} />
          {locatedItems.map(item => (
            <CircleMarker
              key={item.id}
              center={[item.latitude!, item.longitude!]}
              radius={9}
              pathOptions={{ color: '#fff', weight: 3, fillColor: '#168B8A', fillOpacity: 1 }}
            >
              <Popup>
                <div className="min-w-44 text-[#18212B]">
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {item.categoryLabel} · {item.city}
                  </p>
                  {item.address ? <p className="mt-1 text-xs text-slate-600">{item.address}</p> : null}
                  <Link
                    href={item.bookingUrl}
                    className="mt-3 inline-flex rounded-lg bg-[#18212B] px-3 py-2 text-xs font-bold text-white"
                  >
                    Prenota
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        {locatedItems.length === 0
          ? 'Nessuna attività trovata ha ancora una posizione sulla mappa.'
          : `${locatedItems.length} ${locatedItems.length === 1 ? 'attività' : 'attività'} sulla mappa.`}
        {' '}La mappa usa OpenStreetMap; le posizioni mancanti non vengono stimate.
      </p>
    </div>
  )
}
