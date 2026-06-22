type Props = {
  soundEnabled: boolean
  notificationsSupported: boolean
  notificationsEnabled: boolean
  onToggleSound: () => void
  onToggleNotifications: () => void
  onNewBooking: () => void
}

export function BookingsPageHeader({
  soundEnabled,
  notificationsSupported,
  notificationsEnabled,
  onToggleSound,
  onToggleNotifications,
  onNewBooking,
}: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="hidden md:block text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
          Area gestore
        </p>

        <h1 className="hidden md:block text-3xl font-black tracking-tight text-[#0F1D2D]">
          Prenotazioni
        </h1>

        <p className="text-sm text-slate-600">
          Gestisci conferme, pagamenti e cancellazioni degli appuntamenti.
        </p>
      </div>

      <div className="grid w-full gap-2 md:w-auto md:min-w-[360px]">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onToggleSound}
            className={[
              'h-11 rounded-2xl border px-3 text-xs font-black shadow-sm transition active:scale-[0.98] md:text-sm',
              soundEnabled
                ? 'border-[#1FA7A6]/30 bg-[#E6FFFA] text-[#0F766E]'
                : 'border-slate-200 bg-white text-slate-600 hover:border-[#1FA7A6] hover:text-[#1FA7A6]',
            ].join(' ')}
            title={soundEnabled ? 'Disattiva suoni' : 'Attiva suoni'}
          >
            {soundEnabled ? '🔔 Suoni' : '🔕 Suoni'}
          </button>

          {notificationsSupported ? (
            <button
              type="button"
              onClick={onToggleNotifications}
              className={[
                'h-11 rounded-2xl border px-3 text-xs font-black shadow-sm transition active:scale-[0.98] md:text-sm',
                notificationsEnabled
                  ? 'border-[#1FA7A6]/30 bg-[#E6FFFA] text-[#0F766E]'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-[#1FA7A6] hover:text-[#1FA7A6]',
              ].join(' ')}
              title={notificationsEnabled ? 'Disattiva notifiche' : 'Attiva notifiche'}
            >
              {notificationsEnabled ? '✅ Notifiche' : '🔔 Notifiche'}
            </button>
          ) : (
            <div />
          )}
        </div>

        <button
          type="button"
          onClick={onNewBooking}
          className="w-full rounded-2xl bg-[#FFC145] px-5 py-3 text-sm font-black text-[#0F1D2D] shadow-sm transition active:scale-[0.98] hover:brightness-95"
        >
          + Nuovo appuntamento
        </button>
      </div>
    </div>
  )
}