// src/hooks/useOmokRecord.ts
// 오목 전적 — 오늘/이번주/이번달(원샷 쿼리 버킷팅) + 전체(누적 통계 문서)
import { useState, useCallback } from 'react'
import {
  collection, doc, query, where, orderBy, limit, getDocs, getDoc, Timestamp,
} from 'firebase/firestore'
import { startOfDay, startOfWeek, startOfMonth } from 'date-fns'
import { db } from '../lib/firebase'

export interface RecordBucket {
  win: number
  loss: number
  draw: number
  net: number
}

export interface OmokRecord {
  today: RecordBucket
  week: RecordBucket
  month: RecordBucket
  total: RecordBucket
}

const EMPTY_BUCKET: RecordBucket = { win: 0, loss: 0, draw: 0, net: 0 }

export const EMPTY_RECORD: OmokRecord = {
  today: EMPTY_BUCKET, week: EMPTY_BUCKET, month: EMPTY_BUCKET, total: EMPTY_BUCKET,
}

// "3승 1패" 형태 (무승부 있으면 "3승 1패 1무")
export function formatBucket(b: RecordBucket): string {
  const base = `${b.win}승 ${b.loss}패`
  return b.draw > 0 ? `${base} ${b.draw}무` : base
}

export function useOmokRecord(coupleId: string | null, myUid: string | null) {
  const [record, setRecord] = useState<OmokRecord>(EMPTY_RECORD)

  // 원샷 갱신 — 상시 리스너를 두지 않는다 (패널 펼침·게임 종료·명령 시 호출)
  const refresh = useCallback(async (): Promise<OmokRecord> => {
    if (!coupleId || !myUid) return EMPTY_RECORD
    try {
      const now = new Date()
      const dayStart = startOfDay(now).getTime()
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }).getTime()
      const monthStart = startOfMonth(now).getTime()
      const rangeStart = Math.min(weekStart, monthStart)

      const [resultsSnap, statsSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'couples', coupleId, 'gameResults'),
          where('game', '==', 'omok'),
          where('finishedAt', '>=', Timestamp.fromMillis(rangeStart)),
          orderBy('finishedAt', 'desc'),
          limit(500),
        )),
        getDoc(doc(db, 'couples', coupleId, 'gameStats', 'omok')),
      ])

      const buckets = {
        today: { ...EMPTY_BUCKET }, week: { ...EMPTY_BUCKET }, month: { ...EMPTY_BUCKET },
      }
      resultsSnap.docs.forEach((d) => {
        const data = d.data()
        const at = (data['finishedAt'] as Timestamp | null)?.toMillis() ?? 0
        const winnerUid = data['winnerUid'] as string | null
        const bet = (data['bet'] as number) ?? 0
        const isDraw = data['draw'] === true
        const isCancelled = data['result'] === 'cancelled'
        if (isCancelled) return
        const apply = (b: RecordBucket) => {
          if (isDraw) b.draw += 1
          else if (winnerUid === myUid) { b.win += 1; b.net += bet }
          else if (winnerUid != null) { b.loss += 1; b.net -= bet }
        }
        if (at >= dayStart) apply(buckets.today)
        if (at >= weekStart) apply(buckets.week)
        if (at >= monthStart) apply(buckets.month)
      })

      const stats = statsSnap.exists() ? statsSnap.data() : null
      const wins = (stats?.['wins'] as Record<string, number> | undefined) ?? {}
      const nets = (stats?.['net'] as Record<string, number> | undefined) ?? {}
      const total = (stats?.['total'] as number) ?? 0
      const draws = (stats?.['draws'] as number) ?? 0
      const myWins = wins[myUid] ?? 0
      const totalBucket: RecordBucket = {
        win: myWins,
        loss: Math.max(total - draws - myWins, 0),
        draw: draws,
        net: nets[myUid] ?? 0,
      }

      const next: OmokRecord = { ...buckets, total: totalBucket }
      setRecord(next)
      return next
    } catch (err) {
      console.warn('[useOmokRecord] refresh failed', err)
      return EMPTY_RECORD
    }
  }, [coupleId, myUid])

  return { record, refresh }
}
