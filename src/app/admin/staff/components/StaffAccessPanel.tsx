import type { StaffAccess } from '../types'
import { ACCESS_PAGES } from '../constants'

type Props = {
  open: boolean
  staffLoginCode: string | null
  accessMsg: string | null
  accessUsername: string
  accessPassword: string
  allowedPages: string[]
  accessSaving: boolean
  tenantId: string
  loadingAccesses: boolean
  staffAccesses: StaffAccess[]

  setAccessUsername: (value: string) => void
  setAccessPassword: (value: string) => void
  toggleAllowedPage: (page: string) => void
  createStaffAccess: () => void | Promise<void>
  deleteStaffAccess: (access: StaffAccess) => void | Promise<void>
}

export function StaffAccessPanel({
  open,
  staffLoginCode,
  accessMsg,
  accessUsername,
  accessPassword,
  allowedPages,
  accessSaving,
  tenantId,
  loadingAccesses,
  staffAccesses,
  setAccessUsername,
  setAccessPassword,
  toggleAllowedPage,
  createStaffAccess,
  deleteStaffAccess,
}: Props) {
  return (
    <div className={open ? 'block' : 'hidden md:block'}>
      <div className="grid gap-4 p-5">
        {staffLoginCode ? (
          <div className="rounded-3xl border border-[#D7EEF0] bg-[#F3FBFB] p-4">
            <div className="text-xs font-black uppercase tracking-wide text-[#1FA7A6]">
              Codice attività staff
            </div>

            <div className="mt-1 text-2xl font-black tracking-widest text-[#0F1D2D]">
              {staffLoginCode}
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Serve allo staff per accedere al gestionale insieme a username e password.
            </p>
          </div>
        ) : null}

        {accessMsg ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800">
            {accessMsg}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-bold text-[#0F1D2D]">Username</span>
            <input
              value={accessUsername}
              onChange={e => setAccessUsername(e.target.value)}
              placeholder="es. reception"
              className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <span className="text-xs text-slate-500">
              Userà questo username per accedere.
            </span>
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-bold text-[#0F1D2D]">
              Password temporanea
            </span>
            <input
              value={accessPassword}
              onChange={e => setAccessPassword(e.target.value)}
              placeholder="minimo 6 caratteri"
              type="password"
              className="h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-[#1FA7A6] focus:ring-2 focus:ring-[#1FA7A6]/10"
            />
            <span className="text-xs text-slate-500">
              Potrai comunicarla allo staff.
            </span>
          </label>
        </div>

        <div className="grid gap-2">
          <div>
            <div className="text-sm font-bold text-[#0F1D2D]">Pagine consentite</div>
            <div className="mt-1 text-xs text-slate-500">
              Lo staff vedrà solo le sezioni selezionate.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {ACCESS_PAGES.map(page => {
              const active = allowedPages.includes(page.key)

              return (
                <button
                  key={page.key}
                  type="button"
                  onClick={() => toggleAllowedPage(page.key)}
                  className={[
                    'rounded-2xl border px-3 py-2 text-sm font-black transition',
                    active
                      ? 'border-[#1FA7A6] bg-[#E6FFFA] text-[#0F766E]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-[#1FA7A6]',
                  ].join(' ')}
                >
                  {active ? '✓ ' : ''}
                  {page.label}
                </button>
              )
            })}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            Per sicurezza, “Impostazioni” e “Staff & accessi” restano solo al gestore.
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={createStaffAccess}
            disabled={accessSaving || !tenantId}
            className="w-full rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
          >
            {accessSaving ? 'Creazione…' : 'Crea account staff'}
          </button>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-[#0F1D2D]">
                Accessi creati
              </div>
              <div className="text-xs text-slate-500">
                Utenti staff che possono entrare nel gestionale.
              </div>
            </div>

            <span className="rounded-full bg-[#F2F4F7] px-3 py-1 text-xs font-black text-slate-600">
              {staffAccesses.length} totali
            </span>
          </div>

          {loadingAccesses ? (
            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 text-sm text-slate-500">
              Caricamento accessi…
            </div>
          ) : staffAccesses.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 text-sm text-slate-500">
              Nessun accesso staff creato.
            </div>
          ) : (
            <div className="grid gap-2">
              {staffAccesses.map(access => (
                <div
                  key={access.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-[#0F1D2D]">
                        {access.username || 'Senza username'}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {(access.allowed_pages || []).length > 0 ? (
                          (access.allowed_pages || []).map(page => {
                            const label =
                              ACCESS_PAGES.find(p => p.key === page)?.label || page

                            return (
                              <span
                                key={page}
                                className="rounded-full bg-[#E6FFFA] px-2 py-0.5 text-[11px] font-bold text-[#0F766E]"
                              >
                                {label}
                              </span>
                            )
                          })
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                            Nessuna pagina
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteStaffAccess(access)}
                      className="ml-auto shrink-0 rounded-full border border-red-200 bg-white px-3 py-0.5 text-[11px] font-black text-red-700 transition hover:bg-red-50"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}