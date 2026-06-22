type Props = {
  eyebrow: string
  title: string
  open: boolean
  onToggle: () => void
}

export function MobileSectionHeader({
  eyebrow,
  title,
  open,
  onToggle,
}: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between border-b border-[#D7EEF0] bg-gradient-to-r from-[#F3FBFB] to-[#F8FAFC] px-5 py-4 text-left md:hidden"
    >
      <div>
        <p className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-black text-[#0F1D2D]">
          {title}
        </h2>
      </div>

      <span className="text-sm font-black text-slate-400">
        {open ? '▲' : '▼'}
      </span>
    </button>
  )
}