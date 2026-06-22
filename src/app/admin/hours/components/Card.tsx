import type { ReactNode } from 'react'

type Props = {
  title: ReactNode
  subtitle?: string
  children: ReactNode
  right?: ReactNode
}

export function Card({ title, subtitle, children, right }: Props) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-[#F8FAFC] px-5 py-4">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
            Configurazione
          </p>
          <div className="mt-1 text-xl font-black text-[#0F1D2D]">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
          ) : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      {children}
    </section>
  )
}