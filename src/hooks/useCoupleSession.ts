// src/hooks/useCoupleSession.ts
// Firestore users/{uid}.coupleId 실시간 구독 — PC/폰 전환 시 항상 서버 기준
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './useAuth'
import { useApp } from '../context/AppContext'

export function useCoupleSession() {
  const { user, isLoading: authLoading } = useAuth()
  const { coupleId: appCoupleId, uid: appUid, partnerUid } = useApp()
  const [liveCoupleId, setLiveCoupleId] = useState<string | null>(null)
  const [profileReady, setProfileReady] = useState(false)

  // users 문서를 실시간 구독해 coupleId 변경을 즉시 반영한다
  useEffect(() => {
    if (!user) {
      setLiveCoupleId(null)
      setProfileReady(true)
      return
    }

    setProfileReady(false)
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const cid = snap.data()?.coupleId
        setLiveCoupleId(typeof cid === 'string' && cid.length > 0 ? cid : null)
        setProfileReady(true)
      },
      () => {
        setLiveCoupleId(null)
        setProfileReady(true)
      },
    )
    return () => unsub()
  }, [user?.uid])

  const isLoading = authLoading || !profileReady
  const uid = user?.uid ?? null
  const coupleId = !isLoading && liveCoupleId ? liveCoupleId : null
  const isSynced = !!coupleId && coupleId === appCoupleId && uid === appUid

  return { uid, coupleId, partnerUid, isLoading, isSynced }
}
