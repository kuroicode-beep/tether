import { useState, useEffect } from 'react'

type Theme = 'sage' | 'high-contrast'
const THEME_KEY = 'tether_theme'

const isTheme = (value: string | null): value is Theme =>
  value === 'sage' || value === 'high-contrast'

const applyTheme = (nextTheme: Theme) => {
  document.documentElement.setAttribute('data-theme', nextTheme)
  localStorage.setItem(THEME_KEY, nextTheme)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_KEY)
    return isTheme(stored) ? stored : 'sage'
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = (nextTheme: Theme) => {
    applyTheme(nextTheme)
    setThemeState(nextTheme)
  }

  return { theme, setTheme }
}
