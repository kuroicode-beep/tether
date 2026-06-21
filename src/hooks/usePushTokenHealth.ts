// src/hooks/usePushTokenHealth.ts
// permission은 허용됐지만 Firestore fcmTokens에 현재 deviceId가 없을 때 감지
import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getPushDeviceId, reconcilePushPermissionFlag, resetAndSyncPushTokenForUid } from '../lib/pushTokenSync'

type PushTokenHealthState = {
  ready: boolean
  needsResync: boolean
  resyncing: boolean
  resync: () => Promise<boolean>
}

// uid가 있고 알림 권한이 허용된 경우 현재 기기 토큰 등록 여부를 구독한다
export function usePushTokenHealth(uid: string | null): PushTokenHealthState {
  const [ready, setReady] = useState(false)
  const [deviceRegistered, setDeviceRegistered] = useState(true)
  const [resyncing, setResyncing] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 3000)
    return () => window.clearTimeout(timer)
  }, [uid])

  useEffect(() => {
    if (!uid || !reconcilePushPermissionFlag()) {
      setDeviceRegistered(true)
      return
    }

    const deviceId = getPushDeviceId()
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const data = snap.data() ?? {}
        const tokenMap = data.fcmTokens as Record<string, string> | undefined
        const token = tokenMap?.[deviceId]
        setDeviceRegistered(typeof token === 'string' && token.length > 0)
      },
      () => setDeviceRegistered(false),
    )

    return () => unsub()
  }, [uid])

  const resync = useCallback(async (): Promise<boolean> => {
    if (!uid || resyncing) return false
    setResyncing(true)
    try {
      const result = await resetAndSyncPushTokenForUid(uid, 'health_banner_resync')
      return result.ok
    } finally {
      setResyncing(false)
    }
  }, [uid, resyncing])

  const permissionGranted = reconcilePushPermissionFlag()
  const needsResync = ready && !!uid && permissionGranted && !deviceRegistered

  return { ready, needsResync, resyncing, resync }
}
