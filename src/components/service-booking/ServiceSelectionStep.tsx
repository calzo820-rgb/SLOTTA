import type { Service } from './types'

type Props = {
  currentStep: 1 | 2 | 3
  isDesktop: boolean
  services: Service[]
  selectedServiceId: string | null
  onSelectService: (serviceId: string) => void
}

export function ServiceSelectionStep({
  currentStep,
  isDesktop,
  services,
  selectedServiceId,
  onSelectService,
}: Props) {
  if (currentStep !== 1 && !isDesktop) return null

  return (
    <section className="grid gap-4 md:col-span-2">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
            Step 1
          </p>
          <h2 className="text-2xl font-black tracking-tight text-[#0F1D2D]">
            Scegli il servizio
          </h2>
        </div>

        <span className="hidden text-sm font-medium text-slate-500 md:inline">
          Poi scegli giorno e orario
        </span>
      </div>

      {services.length === 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Nessun servizio disponibile al momento.
        </div>
      )}

      <div className="grid gap-3">
        {services.map(svc => {
          const selected = svc.id === selectedServiceId

          return (
            <button
              key={svc.id}
              type="button"
              onClick={() => onSelectService(svc.id)}
              className={[
                'group rounded-3xl border bg-white text-left shadow-sm transition-all duration-200',
                svc.image_url
                  ? 'flex gap-3 p-3 md:p-4'
                  : 'grid gap-1 px-4 py-3 md:px-5 md:py-2',
                selected
                  ? 'border-[#1FA7A6] ring-2 ring-[#1FA7A6]/15'
                  : 'border-slate-200 hover:-translate-y-[1px] hover:border-[#1FA7A6]/50 hover:shadow-md',
              ].join(' ')}
            >
              {svc.image_url ? (
                <img
                  src={svc.image_url}
                  alt={svc.name}
                  className="h-24 w-24 shrink-0 rounded-2xl object-cover md:h-28 md:w-28"
                />
              ) : null}

              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-black text-[#0F1D2D] md:text-lg">
                        {svc.name}
                      </h3>

                      {svc.description && (
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                          {svc.description}
                        </p>
                      )}
                    </div>

                    {selected && (
                      <span className="shrink-0 rounded-full bg-[#FFC145] px-3 py-1 text-xs font-black text-[#0F1D2D]">
                        ✓ Scelto
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className={[
                    'flex items-center justify-between gap-3',
                    svc.image_url ? 'mt-4' : 'mt-2',
                  ].join(' ')}
                >
                  <div className="rounded-full bg-[#F2F4F7] px-3 py-1 text-xs font-bold text-slate-600">
                    {svc.duration_minutes} min
                  </div>

                  <div className="text-base font-black text-[#0F1D2D]">
                    € {(svc.price_cents / 100).toFixed(2)}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}