import { useTheme } from '../hooks/useTheme'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      className="flex"
      style={{
        gap: '4px',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-pill)',
        padding: '4px',
        border: '1px solid var(--color-border)',
      }}
    >
      <button
        onClick={() => setTheme('sage')}
        style={{
          padding: '6px 16px',
          borderRadius: 'var(--radius-pill)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 'calc(0.75rem * var(--font-scale))',
          background: theme === 'sage' ? 'var(--color-primary)' : 'transparent',
          color: theme === 'sage' ? '#fff' : 'var(--color-text-muted)',
          fontWeight: theme === 'sage' ? 600 : 400,
          transition: 'all 200ms ease',
          whiteSpace: 'nowrap',
        }}
      >
        🌿 기본
      </button>
      <button
        onClick={() => setTheme('high-contrast')}
        style={{
          padding: '6px 16px',
          borderRadius: 'var(--radius-pill)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 'calc(0.75rem * var(--font-scale))',
          background: theme === 'high-contrast' ? 'var(--color-primary)' : 'transparent',
          color: theme === 'high-contrast' ? '#fff' : 'var(--color-text-muted)',
          fontWeight: theme === 'high-contrast' ? 600 : 400,
          transition: 'all 200ms ease',
          whiteSpace: 'nowrap',
        }}
      >
        ⚡ 고대비
      </button>
    </div>
  )
}
