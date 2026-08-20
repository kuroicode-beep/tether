// src/lib/maintenanceFlag.ts
// 전체 서비스 점검 스위치.
// true로 두고 배포하면 로그인 여부·커플 연결 여부와 상관없이 모든 접속이 점검 화면에서 멈춘다.
// 점검을 끝낼 때는 false로 바꿔 다시 배포한다.
export const MAINTENANCE_MODE: boolean = true

// 점검 화면에 표시할 안내 문구 (줄바꿈 그대로 나온다)
export const MAINTENANCE_MESSAGE = '더 나은 서비스를 위해 점검 중이에요.\n잠시 뒤에 다시 찾아와 주세요.'

// 관리자가 점검 중에도 앱을 쓰기 위한 우회 값
const BYPASS_KEY = 'tether:maintenance-bypass'
const BYPASS_PARAM = 'bypass'
const BYPASS_VALUE = 'tether-admin'

// ?bypass=tether-admin 으로 한 번 들어오면 이 기기를 기억해 이후에는 그냥 통과시킨다
export function isMaintenanceBypassed(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get(BYPASS_PARAM)
    if (param === BYPASS_VALUE) {
      localStorage.setItem(BYPASS_KEY, BYPASS_VALUE)
      return true
    }
    // 우회를 끄고 점검 화면을 확인하고 싶을 때 쓴다
    if (param === 'off') {
      localStorage.removeItem(BYPASS_KEY)
      return false
    }
    return localStorage.getItem(BYPASS_KEY) === BYPASS_VALUE
  } catch {
    // 저장소를 못 쓰는 환경에서는 점검 화면을 보여주는 쪽으로 둔다
    return false
  }
}
