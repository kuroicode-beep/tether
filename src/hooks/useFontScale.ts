import { useState, useEffect } from 'react'

type FontScale = 'S' | 'M' | 'L' | 'XL'

const scaleMap: Record<FontScale, number> = {
  S: 0.85,
  M: 1.0,
  L: 1.15,
  XL: 1.3,
}

export function useFontScale() {
  const [scale, setScale] = useState<FontScale>(() => {
    return (localStorage.getItem('tether_font_scale') as FontScale) ?? 'M'
  })

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(scaleMap[scale]))
    localStorage.setItem('tether_font_scale', scale)
  }, [scale])

  return { scale, setScale }
}
