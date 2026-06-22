import type { ReactNode } from 'react'

type Props = {
  label: string
  hint?: string
  children: ReactNode
}

export function Field({ label, hint, children }: Props) {
  return (
    <div className="grid gap-1">
      <div className="text-[11px] text-zinc-500">{label}</div>
      {children}
      {hint ? <div className="text-[11px] text-zinc-500">{hint}</div> : null}
    </div>
  )
}