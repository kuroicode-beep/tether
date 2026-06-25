// src/components/MoodChip.tsx
// 기분 태그 칩 — 선택/미선택 상태를 명확히 구분
interface MoodChipProps {
  label: string
  active?: boolean
  variant?: 'display' | 'edit'
}

export function MoodChip({ label, active, variant = 'display' }: MoodChipProps) {
  const activeStyle = variant === 'edit'
    ? {
        background: 'var(--color-text)',
        color: 'var(--color-bg)',
        transform: 'scale(1.1)',
        border: '2px solid var(--color-primary)',
        padding: '5px 12px',
        opacity: 1,
        fontWeight: 700,
        boxShadow: '0 0 0 2px var(--color-bg), 0 0 0 5px var(--color-primary)',
      }
    : {
        background: 'var(--color-primary)',
        color: '#FFFFFF',
        transform: 'scale(1.04)',
        border: '2px solid var(--color-primary)',
        padding: '4px 10px',
        opacity: 1,
        boxShadow: '0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-primary)',
      }

  return (
    <span
      role="text"
      data-active={active ? 'true' : 'false'}
      data-variant={variant}
      aria-label={`기분 태그 ${label}${active ? ' 선택됨' : ' 선택 안 됨'}`}
      className={`mood-chip mood-chip-${variant} hc-readable-box hc-readable-box--pill inline-flex items-center justify-center rounded-full font-label-sm text-[10px] transition-all duration-200`}
      style={
        active
          ? activeStyle
          : {
              background: 'transparent',
              color: 'var(--color-text-muted)',
              transform: 'scale(1)',
              border: '2px solid transparent',
              padding: '4px 10px',
              opacity: 0.4,
            }
      }
    >
      {label}
    </span>
  )
}
