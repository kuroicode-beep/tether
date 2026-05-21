import { useState, useEffect } from 'react'

type Theme = 'sage' | 'high-contrast'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('tether_theme') as Theme) ?? 'sage'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('tether_theme', theme)
  }, [theme])

  return { theme, setTheme }
}
