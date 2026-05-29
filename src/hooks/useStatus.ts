// src/hooks/useStatus.ts
// 커플 상태(컨디션/기분/한줄 메시지) 실시간 구독 및 Firestore 저장
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'

export type Condition = 'tired' | 'normal' | 'good'

export interface UserStatus {
  condition: Condition
  mood: string[]
  message: string
  updatedAt: number | null
}

const DEFAULT_STATUS: UserStatus = {
  condition: 'good',
  mood: [],
  message: '',
  updatedAt: null,
}

const toStatus = (data: Record<string, unknown>): UserStatus => ({
  condition: (data['condition'] as Condition) ?? 'good',
  mood: (data['mood'] as string[]) ?? [],
  message: (data['message'] as string) ?? '',
  updatedAt:
    typeof data['updatedAt'] === 'object' && data['updatedAt'] !== null && 'toMillis' in data['updatedAt']
      ? (data['updatedAt'] as { toMillis: () => number }).toMillis()
      : null,
})

export function useStatus(
  coupleId: string | null,
  myUid: string | null,
  partnerUid: string | null,
) {
  const [myStatus, setMyStatus] = useState<UserStatus>(DEFAULT_STATUS)
  const [partnerStatus, setPartnerStatus] = useState<UserStatus>(DEFAULT_STATUS)

  // 내 상태 문서를 Firestore에서 구독한다
  useEffect(() => {
    if (!coupleId || !myUid) {
      setMyStatus(DEFAULT_STATUS)
      return
    }

    const unsub = onSnapshot(
      doc(db, 'couples', coupleId, 'status', myUid),
      (snap) => {
        if (!snap.exists()) {
          setMyStatus(DEFAULT_STATUS)
          return
        }
        setMyStatus(toStatus(snap.data() as Record<string, unknown>))
      },
    )

    return () => unsub()
  }, [coupleId, myUid])

  // 파트너 상태 문서를 Firestore에서 구독한다
  useEffect(() => {
    if (!coupleId || !partnerUid) {
      setPartnerStatus(DEFAULT_STATUS)
      return
    }

    const unsub = onSnapshot(
      doc(db, 'couples', coupleId, 'status', partnerUid),
      (snap) => {
        if (!snap.exists()) {
          setPartnerStatus(DEFAULT_STATUS)
          return
        }
        setPartnerStatus(toStatus(snap.data() as Record<string, unknown>))
      },
    )

    return () => unsub()
  }, [coupleId, partnerUid])

  // 내 상태를 Firestore에 저장한다
  const updateMyStatus = async (data: Omit<UserStatus, 'updatedAt'>) => {
    if (!coupleId || !myUid) return

    try {
      await setDoc(
        doc(db, 'couples', coupleId, 'status', myUid),
        {
          uid: myUid,
          condition: data.condition,
          mood: data.mood,
          message: data.message,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } catch (error) {
      console.warn('[useStatus] updateMyStatus failed', error)
    }
  }

  return { myStatus, partnerStatus, updateMyStatus }
}
