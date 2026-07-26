// src/hooks/useKeyboardInset.ts
// iOS Safari/PWA에서 소프트 키보드가 가린 높이를 --kb-inset CSS 변수로 노출한다.
//
// 설계 원칙 — 브라우저와 싸우지 않는다:
//  - 문서 스크롤을 강제로 되돌리지 않는다. iOS는 포커스된 입력을 보이게 하려고
//    레이아웃 뷰포트를 밀어 올리는데, 이를 되돌리면 서로 밀고 당기며 진동한다.
//    offsetTop을 계산식에 포함하므로 iOS가 민 만큼은 그대로 반영된다.
//  - 문서나 화면 높이를 바꾸지 않는다. 높이를 바꾸면 리플로우 → 뷰포트 변화 →
//    다시 높이 변화로 이어지는 되먹임이 생긴다.
//  - 입력 바는 transform으로만 띄운다 (레이아웃 영향 없음).
//  - 값을 4px 단위로 양자화하고 8px 미만 변화는 무시해 미세 진동을 막는다.
import { useEffect, useState } from 'react'

// 키보드로 판단할 최소 높이 (주소창 축소 등과 구분)
const KEYBOARD_THRESHOLD = 80
// 값을 이 단위로 반올림해 1px 떨림을 없앤다
const QUANTUM = 4
// 이보다 작은 변화는 무시한다 (키보드 개폐는 수백 px이라 영향 없음)
const MIN_DELTA = 8

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

    const apply = () => {
      const raw = window.innerHeight - vv.height - vv.offsetTop
      const next = Math.max(0, Math.round(raw / QUANTUM) * QUANTUM)
      if (lastInset >= 0 && Math.abs(next - lastInset) < MIN_DELTA) return
      lastInset = next

      root.style.setProperty('--kb-inset', `${next}px`)

      const nextOpen = next > KEYBOARD_THRESHOLD
      if (nextOpen === isOpen) return

      isOpen = nextOpen
      if (nextOpen) document.body.setAttribute('data-keyboard', 'open')
      else document.body.removeAttribute('data-keyboard')
      setOpen(nextOpen)
    }

    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    }

    apply()
    vv.addEventListener('resize', schedule)
    vv.addEventListener('scroll', schedule)

    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', schedule)
      vv.removeEventListener('scroll', schedule)
      root.style.setProperty('--kb-inset', '0px')
      document.body.removeAttribute('data-keyboard')
    }
  }, [])

  return open
}
