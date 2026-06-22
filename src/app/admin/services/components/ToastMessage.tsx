import type { ToastState } from '../types'

type Props = {
  toast: ToastState
}

export function ToastMessage({ toast }: Props) {
  if (!toast) return null

  return (
    <div
      className={[
        'fixed right-4 top-4 z-50 rounded-2xl border bg-white px-4 py-3 text-sm shadow-xl',
        toast.type === 'success'
          ? 'border-green-200'
          : toast.type === 'error'
          ? 'border-red-200'
          : 'border-slate-200',
      ].join(' ')}
    >
      <div className="font-bold text-[#0F1D2D]">
        {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}{' '}
        {toast.message}
      </div>
    </div>
  )
}