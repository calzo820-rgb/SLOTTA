type Props = {
  visible: boolean
}

export function CancelPaymentAlert({ visible }: Props) {
  if (!visible) return null

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
        Il pagamento non è stato completato. Puoi riprovare mantenendo i dati selezionati.
      </div>
    </div>
  )
}