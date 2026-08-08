// src/components/GameBankSheet.tsx
// 게임 은행 시트 — 잔고·충전(쿨다운 표시)·사용내역 (충전 이력 + 게임 결과 파생)
import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, where, orderBy, limit, getDocs, Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import {
  CHARGE_AMOUNT, MAX_DAILY_CHARGES,
  computeChargeEligibility, formatKrw, formatRemaining,
  type ChargeEligibility,
} from '../lib/gameWallet'
import type { ChargeAttempt } from '../hooks/useGameWallet'
import { startOfDay } from 'date-fns'

interface HistoryEntry {
  id: string
  at: number
  label: string
  delta: number
}

interface GameBankSheetProps {
  coupleId: string | null
  myUid: string | null
  balance: number | null
  onCharge: () => Promise<ChargeAttempt>
  onClose: () => void
}

// 일시를 "8/7 16:30" 형태로
function formatEntryTime(at: number): string {
  const d = new Date(at)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
}

export function GameBankSheet({ coupleId, myUid, balance, onCharge, onClose }: GameBankSheetProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [eligibility, setEligibility] = useState<ChargeEligibility | null>(null)
  const [todayCount, setTodayCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [charging, setCharging] = useState(false)

  // 충전 이력 + 오목 결과를 병합해 사용내역을 만든다 (별도 원장 없음)
  const load = useCallback(async () => {
    if (!coupleId || !myUid) return
    setLoading(true)
    try {
      const [chargesSnap, resultsSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'couples', coupleId, 'wallets', myUid, 'charges'),
          orderBy('at', 'desc'),
          limit(10),
        )),
        getDocs(query(
          collection(db, 'couples', coupleId, 'gameResults'),
          where('game', '==', 'omok'),
          orderBy('finishedAt', 'desc'),
          limit(30),
        )),
      ])

      const chargeTimes = chargesSnap.docs
        .map((d) => (d.data()['at'] as Timestamp | null)?.toMillis() ?? null)
        .filter((t): t is number => t != null)
      const now = Date.now()
      setEligibility(computeChargeEligibility(chargeTimes, now))
      const dayStart = startOfDay(new Date(now)).getTime()
      setTodayCount(chargeTimes.filter((t) => t >= dayStart).length)

      const merged: HistoryEntry[] = [
        ...chargesSnap.docs.map((d) => ({
          id: `charge_${d.id}`,
          at: (d.data()['at'] as Timestamp | null)?.toMillis() ?? 0,
          label: '충전',
          delta: (d.data()['amount'] as number) ?? CHARGE_AMOUNT,
        })),
        ...resultsSnap.docs.map((d) => {
          const data = d.data()
          const at = (data['finishedAt'] as Timestamp | null)?.toMillis() ?? 0
          const bet = (data['bet'] as number) ?? 0
          const winnerUid = data['winnerUid'] as string | null
          if (data['result'] === 'cancelled') return { id: `game_${d.id}`, at, label: '오목 취소', delta: 0 }
          if (data['draw'] === true) return { id: `game_${d.id}`, at, label: '오목 무승부', delta: 0 }
          if (winnerUid === myUid) return { id: `game_${d.id}`, at, label: '오목 승리', delta: bet }
          return { id: `game_${d.id}`, at, label: '오목 패배', delta: -bet }
        }),
      ].sort((a, b) => b.at - a.at).slice(0, 30)

      setEntries(merged)
    } catch (err) {
      console.warn('[GameBankSheet] load failed', err)
    } finally {
      setLoading(false)
    }
  }, [coupleId, myUid])

  useEffect(() => {
    void load()
  }, [load])

  const handleCharge = useCallback(async () => {
    if (charging) return
    setCharging(true)
    try {
      await onCharge()
      await load()
    } finally {
      setCharging(false)
    }
  }, [charging, onCharge, load])

  const chargeDisabled = charging || loading || eligibility?.ok === false
  const chargeStatusText = eligibility == null || eligibility.ok
    ? `오늘 ${todayCount}/${MAX_DAILY_CHARGES}회 사용`
    : eligibility.reason === 'daily'
      ? `오늘 충전 ${MAX_DAILY_CHARGES}회를 모두 사용했어요 (내일 가능)`
      : `오늘 ${todayCount}/${MAX_DAILY_CHARGES}회 · 다음 충전까지 ${formatRemaining((eligibility.nextAt ?? 0) - Date.now())}`

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="attachment-sheet game-bank-sheet z-50 bg-surface rounded-t-3xl px-margin-mobile pt-lg pb-xxl shadow-2xl">
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />
        <p className="game-bank-title">게임 은행</p>

        <div className="game-bank-balance">
          <span className="game-bank-balance-label">내 잔고</span>
          <span className="game-bank-balance-value">
            {balance != null ? formatKrw(balance) : '확인 중…'}
          </span>
        </div>

        <button
          type="button"
          className="game-bank-charge-btn"
          onClick={handleCharge}
          disabled={chargeDisabled}
        >
          {charging ? '충전 중…' : `${formatKrw(CHARGE_AMOUNT)} 충전`}
        </button>
        <p className="game-bank-charge-status" role="status">{chargeStatusText}</p>

        <p className="game-bank-section-title">사용내역</p>
        <div className="game-bank-history">
          {loading && <p className="game-bank-empty">불러오는 중…</p>}
          {!loading && entries.length === 0 && (
            <p className="game-bank-empty">아직 내역이 없어요</p>
          )}
          {!loading && entries.map((entry) => (
            <div key={entry.id} className="game-bank-row">
              <span className="game-bank-row-time">{formatEntryTime(entry.at)}</span>
              <span className="game-bank-row-label">{entry.label}</span>
              <span className={`game-bank-row-delta${entry.delta > 0 ? ' plus' : entry.delta < 0 ? ' minus' : ''}`}>
                {entry.delta > 0 ? '+' : ''}{entry.delta === 0 ? '—' : formatKrw(entry.delta)}
              </span>
            </div>
          ))}
        </div>

        <button type="button" className="game-bank-close-btn" onClick={onClose}>닫기</button>
      </div>
    </>
  )
}
