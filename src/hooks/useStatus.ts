// src/hooks/useStatus.ts
// Subscribes to both partners' current status and appends status changes to history.
import { useEffect, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export type Condition = 'very_bad' | 'bad' | 'normal' | 'good' | 'very_good'

export const CONDITION_EMOJI: Record<Condition, string> = {
  very_bad: '😭',
  bad: '😔',
  normal: '🙂',
  good: '😊',
  very_good: '😄',
}

const LEGACY_CONDITION: Record<string, Condition> = {
  tired: 'bad',
  normal: 'normal',
  good: 'good',
}

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

// Converts legacy and current Firestore condition values into the current 5-step model.
const toCondition = (value: unknown): Condition => {
  const raw = String(value ?? 'good')
  if (raw in CONDITION_EMOJI) return raw as Condition
  return LEGACY_CONDITION[raw] ?? 'good'
}

// Converts a Firestore status document into the local status shape.
const toStatus = (data: Record<string, unknown>): UserStatus => ({
  condition: toCondition(data.condition),
  mood: Array.isArray(data.mood) ? (data.mood as string[]) : [],
  message: (data.message as string) ?? '',
  updatedAt:
    typeof data.updatedAt === 'object' && data.updatedAt !== null && 'toMillis' in data.updatedAt
      ? (data.updatedAt as { toMillis: () => number }).toMillis()
      : null,
})

export function useStatus(
  coupleId: string | null,
  myUid: string | null,
  partnerUid: string | null,
) {
  const [myStatus, setMyStatus] = useState<UserStatus>(DEFAULT_STATUS)
  const [partnerStatus, setPartnerStatus] = useState<UserStatus>(DEFAULT_STATUS)

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

  const updateMyStatus = async (data: Omit<UserStatus, 'updatedAt'>) => {
    if (!coupleId || !myUid) return

    try {
      const now = serverTimestamp()
      await setDoc(
        doc(db, 'couples', coupleId, 'status', myUid),
        {
          uid: myUid,
          condition: data.condition,
          mood: data.mood,
          message: data.message,
          updatedAt: now,
        },
        { merge: true },
      )
      await addDoc(collection(db, 'couples', coupleId, 'statusHistory'), {
        uid: myUid,
        condition: data.condition,
        mood: data.mood,
        message: data.message,
        createdAt: now,
      })
    } catch (error) {
      console.warn('[useStatus] updateMyStatus failed', error)
    }
  }

  return { myStatus, partnerStatus, updateMyStatus }
}
