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

const LS_MY = 'tether_my_status'
const LS_PARTNER = 'tether_partner_status'

export function useStatus(
  coupleId: string | null,
  myUid: string | null,
  partnerUid: string | null,
) {
  const [myStatus, setMyStatus] = useState<UserStatus>(() => {
    try { return JSON.parse(localStorage.getItem(LS_MY) ?? '') } catch { return DEFAULT_STATUS }
  })
  const [partnerStatus, setPartnerStatus] = useState<UserStatus>(() => {
    try { return JSON.parse(localStorage.getItem(LS_PARTNER) ?? '') } catch { return DEFAULT_STATUS }
  })

  useEffect(() => {
    if (!coupleId || !partnerUid) return
    let unsub: (() => void) | undefined
    try {
      unsub = onSnapshot(
        doc(db, 'couples', coupleId, 'status', partnerUid),
        (snap) => {
          if (!snap.exists()) return
          const d = snap.data()
          const status: UserStatus = {
            condition: (d['condition'] as Condition) ?? 'good',
            mood: (d['mood'] as string[]) ?? [],
            message: (d['message'] as string) ?? '',
            updatedAt: d['updatedAt']?.toMillis() ?? Date.now(),
          }
          setPartnerStatus(status)
          localStorage.setItem(LS_PARTNER, JSON.stringify(status))
        },
        () => { /* Firebase 미설정 — 로컬 상태 유지 */ },
      )
    } catch { /* ignore */ }
    return () => unsub?.()
  }, [coupleId, partnerUid])

  const updateMyStatus = async (data: Omit<UserStatus, 'updatedAt'>) => {
    const next: UserStatus = { ...data, updatedAt: Date.now() }
    setMyStatus(next)
    localStorage.setItem(LS_MY, JSON.stringify(next))
    if (!coupleId || !myUid) return
    try {
      await setDoc(
        doc(db, 'couples', coupleId, 'status', myUid),
        { condition: data.condition, mood: data.mood, message: data.message, updatedAt: serverTimestamp() },
      )
    } catch { /* Firebase 미설정 — 로컬만 저장 */ }
  }

  return { myStatus, partnerStatus, updateMyStatus }
}
