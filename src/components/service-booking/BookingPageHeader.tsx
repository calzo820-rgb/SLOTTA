import type { TenantInfo } from './types'
import Image from 'next/image'

type Props = {
  tenant: TenantInfo
  mapsUrl: string | null
  onOpenContactSheet: () => void
}

export function BookingPageHeader({
  tenant,
  mapsUrl,
  onOpenContactSheet,
}: Props) {
  const hasContactInfo =
    tenant.phone ||
    tenant.whatsapp_phone ||
    tenant.contact_email ||
    tenant.instagram_url ||
    tenant.website_url ||
    tenant.address

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {tenant.logo_url ? (
            <Image
              src={tenant.logo_url}
              alt={tenant.name}
              width={48}
              height={48}
              unoptimized
              className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0F1D2D] text-lg font-black text-white shadow-sm">
              {tenant.name?.charAt(0) || 'S'}
            </div>
          )}

          <div className="min-w-0">
            <h1 className="truncate text-xl font-black tracking-tight text-[#0F1D2D] md:text-2xl">
              {tenant.name}
            </h1>

            {tenant.address && mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-slate-500 transition hover:text-[#1FA7A6]"
              >
                <span>📍</span>
                <span className="truncate">{tenant.address}</span>
                <span className="hidden text-[10px] text-slate-400 sm:inline">
                  (Apri Maps)
                </span>
              </a>
            )}
          </div>
        </div>

        <a
          href="https://slotta.it"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-2 rounded-full bg-[#0F1D2D] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#17263A] hover:shadow-md md:inline-flex"
          title="Scopri Slotta"
        >
          <span className="h-2 w-2 rounded-full bg-[#FFC145]" />
          Powered by Slotta
        </a>

        {hasContactInfo && (
          <button
            type="button"
            onClick={onOpenContactSheet}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg shadow-sm active:scale-[0.98] md:hidden"
            title="Informazioni attività"
            aria-label="Informazioni attività"
          >
            ℹ️
          </button>
        )}
      </div>
    </header>
  )
}
