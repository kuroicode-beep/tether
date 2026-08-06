// src/hooks/useKeyboardInset.ts
// 소프트 키보드가 열렸을 때 화면을 실제 보이는 영역에 맞춘다.
//
// CSS 변수 두 개를 노출한다:
//  --vv-height : 실제로 보이는 높이 (visualViewport.height)
//  --kb-inset  : 레이아웃 뷰포트 기준으로 키보드가 가린 높이
//
// iOS는 상황에 따라 두 가지로 동작한다:
//  A) 홈 화면 PWA 등 — 키보드가 레이아웃 뷰포트 자체를 줄인다.
//     이때 --kb-inset은 0이고, position:fixed bottom:0이 이미 키보드 위에 붙는다.
//     하지만 100dvh는 줄지 않으므로 화면이 키보드 뒤로 넘어간다 → --vv-height가 필요하다.
//  B) 사파리 탭 — 레이아웃 뷰포트가 그대로다.
//     이때 --kb-inset이 키보드 높이이고, 고정 요소를 그만큼 띄워야 한다.
// 두 변수를 함께 쓰면 어느 쪽이든 입력 바 윗변이 화면 바닥에서 정확히
// 입력 바 높이만큼 위에 오도록 일치한다.
//
// 설계 원칙 — 브라우저와 싸우지 않는다:
//  문서 스크롤을 강제로 되돌리지 않는다. iOS가 뷰포트를 밀면 그대로 따라간다.
//  되돌리려 하면 서로 밀고 당기며 화면이 진동한다.
import { useEffect, useState } from 'react'

// 키보드가 열렸다고 판단할 최소 높이 감소량
const KEYBOARD_THRESHOLD = 80
// 인셋을 이 단위로 반올림해 1px 떨림을 없앤다 (transform 전용이라 안전)
const QUANTUM = 4
// 이보다 작은 변화는 무시한다
const MIN_DELTA = 2

export function useKeyboardInset(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement

    // visualViewport 미지원 브라우저는 기존 동작(100dvh)을 그대로 쓴다
    if (!vv) return

    let raf = 0
    let lastInset = -1
    let lastHeight = -1
    let lastTop = -1
    let maxHeight = 0
    let isOpen = false

    const apply = () => {
      const height = Math.round(vv.height)
      // 키보드가 없을 때의 높이를 기준값으로 기억한다
      if (height > maxHeight) maxHeight = height

      if (lastHeight < 0 || Math.abs(height - lastHeight) >= MIN_DELTA) {
        lastHeight = height
        root.style.setProperty('--vv-height', `${height}px`)
      }

      // 보이는 영역의 시작 위치. 화면을 여기에 그대로 붙인다.
      const top = Math.max(0, Math.round(vv.offsetTop))
      if (lastTop < 0 || Math.abs(top - lastTop) >= MIN_DELTA) {
        lastTop = top
        root.style.setProperty('--vv-top', `${top}px`)
      }

      const rawInset = window.innerHeight - vv.height - vv.offsetTop
      const inset = Math.max(0, Math.round(rawInset / QUANTUM) * QUANTUM)
      if (lastInset < 0 || Math.abs(inset - lastInset) >= MIN_DELTA) {
        lastInset = inset
        root.style.setProperty('--kb-inset', `${inset}px`)
      }

      // 레이아웃 뷰포트가 줄어드는 환경(A)에서도 열림을 감지하도록
      // 인셋이 아니라 높이 감소량으로 판단한다
      const nextOpen = maxHeight - height > KEYBOARD_THRESHOLD
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
      root.style.removeProperty('--vv-height')
      root.style.removeProperty('--vv-top')
      root.style.setProperty('--kb-inset', '0px')
      document.body.removeAttribute('data-keyboard')
    }
  }, [])

  return open
}
