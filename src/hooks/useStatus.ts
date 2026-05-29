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

export function useStatus(
  coupleId: string | null,
  myUid: string | null,
  partnerUid: string | null,
) {
  const [myStatus, setMyStatus] = useState<UserStatus>(DEFAULT_STATUS)
  const [partnerStatus, setPartnerStatus] = useState<UserStatus>(DEFAULT_STATUS)

  useEffect(() => {
    if (!coupleId || !partnerUid) {
      setPartnerStatus(DEFAULT_STATUS)
      return
    }

    const unsub = onSnapshot(
      doc(db, 'couples', coupleId, 'status', partnerUid),
      (snap) => {
        if (!snap.exists()) return
        const d = snap.data()
        setPartnerStatus({
          condition: (d['condition'] as Condition) ?? 'good',
          mood: (d['mood'] as string[]) ?? [],
          message: (d['message'] as string) ?? '',
          updatedAt: d['updatedAt']?.toMillis() ?? Date.now(),
        })
      },
    )

    return () => unsub()
  }, [coupleId, partnerUid])

  const updateMyStatus = async (data: Omit<UserStatus, 'updatedAt'>) => {
    const next: UserStatus = { ...data, updatedAt: Date.now() }
    setMyStatus(next)
    if (!coupleId || !myUid) return

    try {
      await setDoc(
        doc(db, 'couples', coupleId, 'status', myUid),
        {
          condition: data.condition,
          mood: data.mood,
          message: data.message,
          updatedAt: serverTimestamp(),
        },
      )
    } catch { /* ignore */ }
  }

  return { myStatus, partnerStatus, updateMyStatus }
}
