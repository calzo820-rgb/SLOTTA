type Props = {
  label: string
  className: string
}

export function CalendarChip({ label, className }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-black ${className}`}
    >
      {label}
    </span>
  )
}