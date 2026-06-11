import { useState, useEffect } from 'react'

export type FontScale = 'S' | 'M' | 'L'
export type AppFontFamily =
  | 'default'
  | 'cafe24-dongdong'
  | 'maplestory'
  | 'nanum-gothic'
  | 'line-seed'
  | 'gowun-dodum'
  | 'nanum-square-round'
  | 'tmoney-round'
  | 'recipe-korea'
  | 'kyobo-handwriting-2019'

const scaleMap: Record<FontScale, number> = {
  S: 0.92,
  M: 1.0,
  L: 1.14,
}

export const FONT_SCALE_OPTIONS: Array<{ id: FontScale; label: string }> = [
  { id: 'S', label: '소' },
  { id: 'M', label: '중' },
  { id: 'L', label: '대' },
]

export const FONT_FAMILY_OPTIONS: Array<{ id: AppFontFamily; label: string; css: string }> = [
  { id: 'default', label: '기본', css: "'Inter', 'Nanum Gothic', sans-serif" },
  { id: 'cafe24-dongdong', label: '카페24동동체', css: "'Cafe24Dongdong', 'Nanum Gothic', sans-serif" },
  { id: 'maplestory', label: '메이플스토리체', css: "'Maplestory', 'Nanum Gothic', sans-serif" },
  { id: 'nanum-gothic', label: '나눔고딕', css: "'Nanum Gothic', sans-serif" },
  { id: 'line-seed', label: '라인시드체', css: "'LINE Seed Sans KR', 'Nanum Gothic', sans-serif" },
  { id: 'gowun-dodum', label: '고운돋움체', css: "'Gowun Dodum', sans-serif" },
  { id: 'nanum-square-round', label: '나눔스퀘어라운드R', css: "'NanumSquareRound', 'Nanum Gothic', sans-serif" },
  { id: 'tmoney-round', label: '티머니둥근바람체', css: "'TmoneyRoundWind', 'Nanum Gothic', sans-serif" },
  { id: 'recipe-korea', label: '레코체', css: "'Recipekorea', 'Nanum Gothic', sans-serif" },
  { id: 'kyobo-handwriting-2019', label: '교보손글씨2019', css: "'KyoboHandwriting2019', 'Nanum Gothic', cursive" },
]

const LS_SCALE = 'tether_font_scale'
const LS_FONT = 'tether_font_family'

function isFontScale(value: string | null): value is FontScale {
  return value === 'S' || value === 'M' || value === 'L'
}

function isAppFontFamily(value: string | null): value is AppFontFamily {
  return FONT_FAMILY_OPTIONS.some((option) => option.id === value)
}

function fontCss(fontFamily: AppFontFamily): string {
  return FONT_FAMILY_OPTIONS.find((option) => option.id === fontFamily)?.css ?? FONT_FAMILY_OPTIONS[0].css
}

// 앱 부트 시 localStorage 글자 크기와 폰트를 document에 적용한다
export function bootstrapFontScale() {
  const stored = localStorage.getItem('tether_font_scale') as FontScale | null
  const scale = isFontScale(stored) ? stored : 'M'
  const storedFont = localStorage.getItem(LS_FONT)
  const fontFamily = isAppFontFamily(storedFont) ? storedFont : 'default'
  document.documentElement.style.setProperty('--font-scale', String(scaleMap[scale]))
  document.documentElement.style.setProperty('--app-font-family', fontCss(fontFamily))
}

export function useFontScale() {
  const [scale, setScale] = useState<FontScale>(() => {
    const stored = localStorage.getItem(LS_SCALE)
    return isFontScale(stored) ? stored : 'M'
  })
  const [fontFamily, setFontFamily] = useState<AppFontFamily>(() => {
    const stored = localStorage.getItem(LS_FONT)
    return isAppFontFamily(stored) ? stored : 'default'
  })

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(scaleMap[scale]))
    localStorage.setItem(LS_SCALE, scale)
  }, [scale])

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-family', fontCss(fontFamily))
    localStorage.setItem(LS_FONT, fontFamily)
  }, [fontFamily])

  return { scale, setScale, fontFamily, setFontFamily }
}
