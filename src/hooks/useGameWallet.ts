// src/hooks/useGameWallet.ts
// 게임머니 지갑 — 내 지갑 실시간 구독(없으면 시드), 충전(하루 3회·8시간 쿨다운)
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  doc, collection, onSnapshot, setDoc, updateDoc, addDoc, getDocs,
  query, orderBy, limit, serverTimestamp, increment, Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import {
  WALLET_SEED, CHARGE_AMOUNT, MAX_DAILY_CHARGES,
  computeChargeEligibility, type ChargeEligibility,
} from '../lib/gameWallet'

export interface ChargeAttempt extends ChargeEligibility {
  balanceAfter?: number
}

export function useGameWallet(coupleId: string | null, myUid: string | null) {
  const [balance, setBalance] = useState<number | null>(null)
  const seedingRef = useRef(false)

  // 내 지갑 단일 문서 구독 — 없으면 초기 자금을 시드한다
  useEffect(() => {
    if (!coupleId || !myUid) {
      setBalance(null)
      return
    }
    const ref = doc(db, 'couples', coupleId, 'wallets', myUid)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          if (!seedingRef.current) {
            seedingRef.current = true
            setDoc(ref, {
              balance: WALLET_SEED,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch((err) => console.warn('[useGameWallet] seed failed', err))
          }
          return
        }
        seedingRef.current = false
        setBalance((snap.data()['balance'] as number) ?? 0)
      },
      (err) => console.warn('[useGameWallet] listener error', err),
    )
    return () => unsub()
  }, [coupleId, myUid])

  // 최근 충전 시각(ms, 최신순)을 서버 기록 기준으로 가져온다
  const fetchChargeTimes = useCallback(async (): Promise<number[]> => {
    if (!coupleId || !myUid) return []
    const snap = await getDocs(query(
      collection(db, 'couples', coupleId, 'wallets', myUid, 'charges'),
      orderBy('at', 'desc'),
      limit(MAX_DAILY_CHARGES),
    ))
    return snap.docs
      .map((d) => (d.data()['at'] as Timestamp | null)?.toMillis() ?? null)
      .filter((t): t is number => t != null)
  }, [coupleId, myUid])

  // 지금 충전 가능한지 판정만 한다 (쓰기 없음) — 잔액 5만원 이하 조건 포함
  const getChargeEligibility = useCallback(async (): Promise<ChargeEligibility> => {
    const times = await fetchChargeTimes()
    return computeChargeEligibility(times, Date.now(), balance ?? 0)
  }, [fetchChargeTimes, balance])

  // 5만원 충전 — 판정 통과 시 이력 기록 + 잔액 증가
  const charge = useCallback(async (): Promise<ChargeAttempt> => {
    if (!coupleId || !myUid) return { ok: false }
    const eligibility = await getChargeEligibility()
    if (!eligibility.ok) return eligibility
    try {
      await addDoc(collection(db, 'couples', coupleId, 'wallets', myUid, 'charges'), {
        amount: CHARGE_AMOUNT,
        at: serverTimestamp(),
      })
      await updateDoc(doc(db, 'couples', coupleId, 'wallets', myUid), {
        balance: increment(CHARGE_AMOUNT),
        updatedAt: serverTimestamp(),
      })
      return { ok: true, balanceAfter: (balance ?? 0) + CHARGE_AMOUNT }
    } catch (err) {
      console.warn('[useGameWallet] charge failed', err)
      return { ok: false }
    }
  }, [coupleId, myUid, balance, getChargeEligibility])

  return { balance, charge, getChargeEligibility, fetchChargeTimes }
}
