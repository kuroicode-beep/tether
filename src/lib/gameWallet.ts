// src/lib/gameWallet.ts
// 게임머니 지갑 상수·충전 가능 판정·금액 포맷 (모든 게임 공용)
import { startOfDay } from 'date-fns'

export const WALLET_SEED = 50_000
export const CHARGE_AMOUNT = 50_000
export const MAX_DAILY_CHARGES = 3
export const CHARGE_COOLDOWN_MS = 8 * 60 * 60 * 1000
// 잔액이 이 금액 이하일 때만 충전할 수 있다
export const CHARGE_BALANCE_LIMIT = 50_000

export const OMOK_DEFAULT_BET = 1_000
export const OMOK_MAX_BET = 50_000
export const OMOK_BET_UNIT = 100

export interface ChargeEligibility {
  ok: boolean
  reason?: 'daily' | 'cooldown' | 'balance'
  nextAt?: number
}

// 충전 이력(최신순 ms 배열)과 현재 잔액으로 지금 충전 가능한지 판정한다.
// 시각은 서버 기록(serverTimestamp) 기준 — 기기 시계 어긋남 영향 최소화.
export function computeChargeEligibility(
  chargeTimesDesc: number[],
  now: number,
  balance: number,
): ChargeEligibility {
  if (balance > CHARGE_BALANCE_LIMIT) {
    return { ok: false, reason: 'balance' }
  }
  const dayStart = startOfDay(new Date(now)).getTime()
  const todayCount = chargeTimesDesc.filter((t) => t >= dayStart).length
  if (todayCount >= MAX_DAILY_CHARGES) {
    return { ok: false, reason: 'daily', nextAt: dayStart + 24 * 60 * 60 * 1000 }
  }
  const latest = chargeTimesDesc[0]
  if (latest != null && latest + CHARGE_COOLDOWN_MS > now) {
    return { ok: false, reason: 'cooldown', nextAt: latest + CHARGE_COOLDOWN_MS }
  }
  return { ok: true }
}

// 12,300 → "12,300원"
export function formatKrw(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

// 남은 시간을 "N시간 M분" 텍스트로 (1분 미만은 "잠시 후")
export function formatRemaining(ms: number): string {
  if (ms < 60_000) return '잠시 후'
  const totalMinutes = Math.ceil(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}분`
  if (minutes === 0) return `${hours}시간`
  return `${hours}시간 ${minutes}분`
}

// 베팅 금액 정규화 — 100원 단위 반올림, 0(친선)~50,000 클램프
export function normalizeBet(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0
  const rounded = Math.round(raw / OMOK_BET_UNIT) * OMOK_BET_UNIT
  return Math.min(Math.max(rounded, 0), OMOK_MAX_BET)
}
