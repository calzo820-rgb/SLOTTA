'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)

  const [showIosHelp, setShowIosHelp] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Check if the app is running in standalone mode (PWA). Some browsers (e.g. iOS Safari)
    // expose a non-standard `standalone` property on navigator; extend the type to access it.
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ((window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true)

    if (isStandalone) {
      setInstalled(true)
      return
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    }
  }, [])

  async function handleInstall() {
    if (installed) return

    if (deferredPrompt) {
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
      return
    }

    setShowIosHelp(true)
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleInstall}
        disabled={installed}
        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-[#0F1D2D] transition hover:border-[#1FA7A6] hover:text-[#1FA7A6] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {installed ? 'App installata' : 'Installa app'}
      </button>

      {showIosHelp ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600 shadow-sm">
          Per installare Slotta: apri il menu del browser e scegli{' '}
          <span className="font-black text-[#0F1D2D]">
            “Aggiungi alla schermata Home”
          </span>
          .
        </div>
      ) : null}
    </div>
  )
}