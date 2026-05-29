import { useTheme } from '../hooks/useTheme'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="theme-toggle-bar">
      <button
        type="button"
        className={theme === 'sage' ? 'active' : ''}
        onClick={() => setTheme('sage')}
      >
        🌿 기본
      </button>
      <button
        type="button"
        className={theme === 'high-contrast' ? 'active' : ''}
        onClick={() => setTheme('high-contrast')}
      >
        ⚡ 고대비
      </button>
    </div>
  )
}
