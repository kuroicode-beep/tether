// src/lib/sidecarIme.ts
// 채팅 입력창 포커스 시 Windows 사이드카에 한글 IME 전환을 요청한다.
// 웹에는 OS 입력기 상태를 바꾸는 API가 없어, 이 PC의 로컬 사이드카가 대신
// 전경 Tether 창의 IME를 한글 모드로 돌려준다. 사이드카가 없는 기기(모바일
// 등)에서는 조용히 무시된다.
import { isMobile } from './firebase'

const SIDECAR_IME_URL = 'http://127.0.0.1:48620/ime/hangul'
const REQUEST_TIMEOUT_MS = 1500
// 포커스가 짧게 반복돼도 사이드카를 연타하지 않도록 하는 최소 간격
const MIN_INTERVAL_MS = 1000

let lastRequestAt = 0

// 실패해도 아무 일도 하지 않는다 — 입력은 그대로 가능하고 IME만 수동 전환하면 된다
export function requestKoreanIme(): void {
  if (isMobile()) return
  const now = Date.now()
  if (now - lastRequestAt < MIN_INTERVAL_MS) return
  lastRequestAt = now
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    void fetch(SIDECAR_IME_URL, { signal: controller.signal })
      .catch(() => { /* 사이드카 미실행 — 무시 */ })
      .finally(() => clearTimeout(timer))
  } catch { /* ignore */ }
}
