// src/hooks/useKeyboardInset.ts
// iOS Safari/PWA에서 소프트 키보드가 가린 높이를 --kb-inset CSS 변수로 노출하고,
// 키보드가 열린 동안 문서가 스크롤되어 화면이 위아래로 튀는 것을 막는다.
import { useEffect, useState } from 'react'

// 키보드로 판단할 최소 높이 (주소창 축소 등과 구분)
const KEYBOARD_THRESHOLD = 80
// 이보다 작은 변화는 무시해 미세 떨림을 막는다
const NOISE_TOLERANCE = 2

export function useKeyboardInset(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement

    // visualViewport 미지원 브라우저는 0으로 두고 기존 동작 유지
    if (!vv) {
      root.style.setProperty('--kb-inset', '0px')
      return
    }

    let raf = 0
    let lastInset = -1
    let isOpen = false

    // 키보드가 열린 동안 iOS가 문서를 밀어 올리는 것을 되돌린다
    const lockDocumentScroll = () => {
      if (!isOpen) return
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
    }

    const apply = () => {
      const next = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      if (lastInset >= 0 && Math.abs(next - lastInset) < NOISE_TOLERANCE) return
      lastInset = next

      root.style.setProperty('--kb-inset', `${next}px`)

      const nextOpen = next > KEYBOARD_THRESHOLD
      if (nextOpen === isOpen) return

      isOpen = nextOpen
      if (nextOpen) {
        document.body.setAttribute('data-keyboard', 'open')
        lockDocumentScroll()
      } else {
        document.body.removeAttribute('data-keyboard')
      }
      setOpen(nextOpen)
    }

    const schedule = () => {
      lockDocumentScroll()
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    }

    apply()
    vv.addEventListener('resize', schedule)
    vv.addEventListener('scroll', schedule)
    window.addEventListener('scroll', lockDocumentScroll, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', schedule)
      vv.removeEventListener('scroll', schedule)
      window.removeEventListener('scroll', lockDocumentScroll)
      root.style.setProperty('--kb-inset', '0px')
      document.body.removeAttribute('data-keyboard')
    }
  }, [])

  return open
}
