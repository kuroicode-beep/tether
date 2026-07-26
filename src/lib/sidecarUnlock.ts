// src/lib/sidecarUnlock.ts
// Windows 사이드카 단축키로 열렸을 때 PIN을 건너뛰기 위한 1회용 토큰 검증.
//
// 안전 근거: 토큰은 이 PC에서 단축키를 실제로 누른 경우에만 발급되고,
// 검증은 127.0.0.1의 사이드카에만 물어볼 수 있다. 다른 기기에서는 URL을
// 그대로 복사해도 로컬 사이드카에 닿지 못하므로 잠금이 풀리지 않는다.
// 토큰은 30초 만료·1회용이라 주소창 기록이 남아도 재사용되지 않는다.

const SIDECAR_UNLOCK_URL = 'http://127.0.0.1:48620/unlock'
const UNLOCK_PARAM = 'unlock'
const REQUEST_TIMEOUT_MS = 1200

// URL에서 토큰을 지운다 (뒤로가기·공유로 다시 쓰이지 않도록)
function stripUnlockParam(): void {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(UNLOCK_PARAM)) return
    url.searchParams.delete(UNLOCK_PARAM)
    window.history.replaceState(window.history.state, '', url.toString())
  } catch { /* URL 조작 실패는 무시한다 */ }
}

// 주소의 unlock 토큰을 로컬 사이드카에 검증한다. 토큰이 없으면 즉시 false.
export async function consumeSidecarUnlockToken(): Promise<boolean> {
  let token: string | null
  try {
    token = new URLSearchParams(window.location.search).get(UNLOCK_PARAM)
  } catch {
    return false
  }
  if (!token) return false

  // 검증 성공 여부와 무관하게 주소에서는 토큰을 지운다
  stripUnlockParam()

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const res = await fetch(
      `${SIDECAR_UNLOCK_URL}?token=${encodeURIComponent(token)}`,
      { signal: controller.signal },
    )
    clearTimeout(timer)
    if (!res.ok) return false
    const data = await res.json() as { ok?: boolean }
    return data.ok === true
  } catch {
    // 사이드카 미실행·타 플랫폼·차단 — 잠금을 유지한다
    return false
  }
}
