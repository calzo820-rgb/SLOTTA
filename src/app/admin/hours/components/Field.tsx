import type { ReactNode } from 'react'

type Props = {
  label: string
  hint?: string
  children: ReactNode
}

export function Field({ label, hint, children }: Props) {
  return (
    <div className="grid min-w-0 gap-2">
      <div className="text-sm font-bold text-[#0F1D2D]">{label}</div>
      {children}
      {hint ? (
        <div className="text-sm leading-5 text-slate-600">{hint}</div>
      ) : null}
    </div>
  )
}
