import type { TenantInfo } from './types'
import {
  cleanPhoneForWhatsapp,
  normalizeInstagramUrl,
  normalizeUrl,
} from './utils'

type Props = {
  open: boolean
  tenant: TenantInfo
  mapsUrl: string | null
  onClose: () => void
}

export function MobileContactSheet({
  open,
  tenant,
  mapsUrl,
  onClose,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-[#0F1D2D]/50 backdrop-blur-sm"
        aria-label="Chiudi informazioni"
      />

      <div className="absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-hidden rounded-t-[2rem] bg-white shadow-2xl">
        <div className="px-4 pt-3">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
              Informazioni
            </p>

            <h3 className="text-xl font-black text-[#0F1D2D]">
              {tenant.name}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Contatti, social e posizione dell’attività.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-[#0F1D2D] active:scale-[0.98]"
          >
            Chiudi
          </button>
        </div>

        <div className="grid max-h-[calc(82vh-110px)] gap-4 overflow-y-auto p-5">
          {(tenant.phone || tenant.whatsapp_phone || tenant.contact_email) && (
            <section className="grid gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">
                  Contatti
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Per chiamate, messaggi o richieste.
                </p>
              </div>

              <div className="grid gap-2">
                {tenant.phone ? (
                  <a
                    href={`tel:${tenant.phone}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm font-bold text-[#0F1D2D] active:scale-[0.99]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white">
                      📞
                    </span>

                    <div className="min-w-0">
                      <div>Chiama</div>
                      <div className="truncate text-xs font-medium text-slate-500">
                        {tenant.phone}
                      </div>
                    </div>
                  </a>
                ) : null}

                {tenant.whatsapp_phone ? (
                  <a
                    href={`https://wa.me/${cleanPhoneForWhatsapp(
                      tenant.whatsapp_phone,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm font-bold text-[#0F1D2D] active:scale-[0.99]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white">
                      💬
                    </span>

                    <div className="min-w-0">
                      <div>WhatsApp</div>
                      <div className="truncate text-xs font-medium text-slate-500">
                        {tenant.whatsapp_phone}
                      </div>
                    </div>
                  </a>
                ) : null}

                {tenant.contact_email ? (
                  <a
                    href={`mailto:${tenant.contact_email}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm font-bold text-[#0F1D2D] active:scale-[0.99]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white">
                      ✉️
                    </span>

                    <div className="min-w-0">
                      <div>Email</div>
                      <div className="truncate text-xs font-medium text-slate-500">
                        {tenant.contact_email}
                      </div>
                    </div>
                  </a>
                ) : null}
              </div>
            </section>
          )}

          {(tenant.instagram_url || tenant.website_url) && (
            <section className="grid gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">
                  Social / web
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Segui l’attività o visita il sito.
                </p>
              </div>

              <div className="grid gap-2">
                {tenant.instagram_url ? (
                  <a
                    href={normalizeInstagramUrl(tenant.instagram_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm font-bold text-[#0F1D2D] active:scale-[0.99]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white">
                      📷
                    </span>

                    <div className="min-w-0">
                      <div>Instagram</div>
                      <div className="truncate text-xs font-medium text-slate-500">
                        {tenant.instagram_url}
                      </div>
                    </div>
                  </a>
                ) : null}

                {tenant.website_url ? (
                  <a
                    href={normalizeUrl(tenant.website_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm font-bold text-[#0F1D2D] active:scale-[0.99]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white">
                      🌐
                    </span>

                    <div className="min-w-0">
                      <div>Sito web</div>
                      <div className="truncate text-xs font-medium text-slate-500">
                        {tenant.website_url}
                      </div>
                    </div>
                  </a>
                ) : null}
              </div>
            </section>
          )}

          {tenant.address && mapsUrl && (
            <section className="grid gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">
                  Posizione
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Apri l’indirizzo su Google Maps.
                </p>
              </div>

              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm font-bold text-[#0F1D2D] active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white">
                  📍
                </span>

                <div className="min-w-0">
                  <div>Apri Maps</div>
                  <div className="truncate text-xs font-medium text-slate-500">
                    {tenant.address}
                  </div>
                </div>
              </a>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}