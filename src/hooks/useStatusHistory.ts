// src/hooks/useStatusHistory.ts
// 커플 상태 변경 히스토리 실시간 구독
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import type { Condition } from './useStatus'

export interface StatusHistoryEntry {
  id: string
  uid: string
  condition: Condition
  mood: string[]
  message: string
  createdAt: number | null
}

export function useStatusHistory(coupleId: string | null) {
  const [history, setHistory] = useState<StatusHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!coupleId) {
      setHistory([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const q = query(
      collection(db, 'couples', coupleId, 'statusHistory'),
      orderBy('createdAt', 'desc'),
      limit(50),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        setHistory(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              uid: (data.uid as string) ?? '',
              condition: (data.condition as Condition) ?? 'good',
              mood: Array.isArray(data.mood) ? (data.mood as string[]) : [],
              message: (data.message as string) ?? '',
              createdAt:
                typeof data.createdAt === 'object' && data.createdAt !== null && 'toMillis' in data.createdAt
                  ? (data.createdAt as { toMillis: () => number }).toMillis()
                  : null,
            }
          }),
        )
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.warn('[useStatusHistory] listener error', err)
        setHistory([])
        setLoading(false)
        setError('상태 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      },
    )

    return () => unsub()
  }, [coupleId])

  return { history, loading, error }
}
