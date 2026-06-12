// src/components/MoodChip.tsx
// 기분 태그 칩 — 선택/미선택 상태를 명확히 구분
interface MoodChipProps {
  label: string
  active?: boolean
}

export function MoodChip({ label, active }: MoodChipProps) {
  return (
    <span
      className="mood-chip hc-readable-box hc-readable-box--pill inline-flex items-center justify-center rounded-full font-label-sm text-[10px] transition-all duration-200"
      style={
        active
          ? {
              background: 'var(--color-primary)',
              color: '#FFFFFF',
              transform: 'scale(1.2)',
              border: '2px solid var(--color-primary)',
              padding: '4px 10px',
              opacity: 1,
            }
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
