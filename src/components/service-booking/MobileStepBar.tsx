type Props = {
  currentStep: 1 | 2 | 3 | 4
  totalSteps: 3 | 4
  mainColor: string
  canGoStep2: boolean
  canGoStep3: boolean
  canGoStep4: boolean
  canSubmit: boolean
  onBack: () => void
  onContinue: () => void
}

export function MobileStepBar({
  currentStep,
  totalSteps,
  mainColor,
  canGoStep2,
  canGoStep3,
  canGoStep4,
  canSubmit,
  onBack,
  onContinue,
}: Props) {
  const nextDisabled =
    (currentStep === 1 && !canGoStep2) ||
    (currentStep === 2 && !canGoStep3) ||
    (currentStep === 3 && !canGoStep4) ||
    (currentStep === 4 && !canSubmit)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 grid gap-3 border-t border-slate-200 bg-white p-3 shadow-[0_-10px_30px_rgba(15,29,45,0.08)] md:hidden">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: totalSteps }, (_, index) => index + 1).map(step => (
          <div
            key={step}
            className="h-2 rounded-full transition"
            style={{
              background: currentStep >= step ? mainColor : '#e2e8f0',
            }}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={currentStep === 1}
          className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-[#0F1D2D] disabled:opacity-40"
        >
          Indietro
        </button>

        <button
          type="button"
          onClick={onContinue}
          disabled={nextDisabled}
          className="flex-1 rounded-2xl bg-[#1FA7A6] px-4 py-3 text-sm font-black text-white disabled:opacity-40"
          style={{ background: mainColor }}
        >
          {currentStep === 4 ? 'Riepilogo' : 'Continua'}
        </button>
      </div>
    </div>
  )
}
