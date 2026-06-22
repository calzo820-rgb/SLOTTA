import type { TenantInfo } from './types'
import {
  cleanPhoneForWhatsapp,
  normalizeInstagramUrl,
  normalizeUrl,
} from './utils'

type Props = {
  tenant: TenantInfo
  mapsUrl: string | null
}

export function DesktopContactFooter({ tenant, mapsUrl }: Props) {
  const hasContactInfo =
    tenant.phone ||
    tenant.whatsapp_phone ||
    tenant.contact_email ||
    tenant.instagram_url ||
    tenant.website_url ||
    tenant.address

  if (!hasContactInfo) return null

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 hidden border-t border-slate-200 bg-white/95 px-6 py-2 shadow-[0_-8px_24px_rgba(15,29,45,0.06)] backdrop-blur-xl md:block">
      <div className="mx-auto grid max-w-7xl grid-cols-3 gap-3">
        {/* CONTATTI */}
        <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] px-3 py-2">
          <div className="text-[10px] font-black uppercase tracking-wide text-[#1FA7A6]">
            Contatti
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {tenant.phone ? (
              <a
                href={`tel:${tenant.phone}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
              >
                <span>📞</span>
                <span>Chiama</span>
              </a>
            ) : null}

            {tenant.whatsapp_phone ? (
              <a
                href={`https://wa.me/${cleanPhoneForWhatsapp(tenant.whatsapp_phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
              >
                <span>💬</span>
                <span>WhatsApp</span>
              </a>
            ) : null}

            {tenant.contact_email ? (
              <a
                href={`mailto:${tenant.contact_email}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
              >
                <span>✉️</span>
                <span>Email</span>
              </a>
            ) : null}
          </div>
        </div>

        {/* SOCIAL */}
        <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] px-3 py-2">
          <div className="text-[10px] font-black uppercase tracking-wide text-[#1FA7A6]">
            Social / web
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {tenant.instagram_url ? (
              <a
                href={normalizeInstagramUrl(tenant.instagram_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
              >
                <span>📷</span>
                <span>Instagram</span>
              </a>
            ) : null}

            {tenant.website_url ? (
              <a
                href={normalizeUrl(tenant.website_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
              >
                <span>🌐</span>
                <span>Sito web</span>
              </a>
            ) : null}
          </div>
        </div>

        {/* POSIZIONE */}
        <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] px-3 py-2">
          <div className="text-[10px] font-black uppercase tracking-wide text-[#1FA7A6]">
            Posizione
          </div>

          <div className="mt-1.5">
            {tenant.address && mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-black text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6]"
              >
                <span>📍</span>
                <span className="truncate">{tenant.address}</span>
              </a>
            ) : (
              <div className="text-xs font-bold text-slate-400">
                Posizione non disponibile
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}