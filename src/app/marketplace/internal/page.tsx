import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import MarketplaceDirectory from '../MarketplaceDirectory'
import { hasMarketplaceInternalAccess } from '@/lib/marketplaceAccess'
import { searchMarketplace } from '@/lib/marketplaceSearch'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Marketplace — test interno',
  robots: { index: false, follow: false, noarchive: true },
}

type SearchParams = {
  q?: string | string[]
  city?: string | string[]
  category?: string | string[]
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export default async function InternalMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  if (!(await hasMarketplaceInternalAccess())) notFound()

  const params = await searchParams
  const q = firstValue(params.q).slice(0, 80)
  const city = firstValue(params.city).slice(0, 80)
  const category = firstValue(params.category).slice(0, 30)
  const result = await searchMarketplace({ q, city, category })

  return (
    <MarketplaceDirectory
      action="/marketplace/internal"
      q={q}
      city={city}
      category={category}
      result={result}
      internal
      allowGeocoding={
        process.env.MARKETPLACE_GEOCODING_ENABLED?.trim().toLowerCase() === 'true'
      }
    />
  )
}
