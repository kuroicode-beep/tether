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

  useEffect(() => {
    if (!coupleId) {
      setHistory([])
      return
    }

    const q = query(
      collection(db, 'couples', coupleId, 'statusHistory'),
      orderBy('createdAt', 'desc'),
      limit(50),
    )

    const unsub = onSnapshot(q, (snap) => {
      setHistory(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            uid: (data.uid as string) ?? '',
            condition: (data.condition as Condition) ?? 'good',
            mood: (data.mood as string[]) ?? [],
            message: (data.message as string) ?? '',
            createdAt:
              typeof data.createdAt === 'object' && data.createdAt !== null && 'toMillis' in data.createdAt
                ? (data.createdAt as { toMillis: () => number }).toMillis()
                : null,
          }
        }),
      )
    })

    return () => unsub()
  }, [coupleId])

  return history
}
