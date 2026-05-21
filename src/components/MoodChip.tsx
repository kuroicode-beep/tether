interface MoodChipProps {
  label: string
  active?: boolean
}

export function MoodChip({ label, active }: MoodChipProps) {
  return (
    <span
      className={`px-sm py-[2px] font-label-sm text-[10px] rounded-full ${
        active
          ? 'bg-primary/10 text-primary'
          : 'bg-surface-variant text-on-surface-variant'
      }`}
    >
      {label}
    </span>
  )
}
