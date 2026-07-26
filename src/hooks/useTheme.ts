import { useState, useEffect } from 'react'

export type Theme = 'sage' | 'dark' | 'high-contrast'
const THEME_KEY = 'tether_theme'

const isTheme = (value: string | null): value is Theme =>
  value === 'sage' || value === 'dark' || value === 'high-contrast'

const applyTheme = (nextTheme: Theme) => {
  document.documentElement.setAttribute('data-theme', nextTheme)
  localStorage.setItem(THEME_KEY, nextTheme)
}

// 주소의 ?theme= 값을 읽고 즉시 제거한다.
// 사이드카 단축키로 열린 채팅창을 다크모드로 띄우는 데 쓴다.
const readThemeFromUrl = (): Theme | null => {
  try {
    const url = new URL(window.location.href)
    const requested = url.searchParams.get('theme')
    if (!isTheme(requested)) return null
    url.searchParams.delete('theme')
    window.history.replaceState(window.history.state, '', url.toString())
    return requested
  } catch {
    return null
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const fromUrl = readThemeFromUrl()
    if (fromUrl) return fromUrl
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
