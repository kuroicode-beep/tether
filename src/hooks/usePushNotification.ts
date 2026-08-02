// src/hooks/usePushNotification.ts
// FCM 토큰 요청, 포그라운드 메시지, 알림 설정 관리
import { useCallback, useMemo } from 'react'
import { onMessage, MessagePayload } from 'firebase/messaging'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db, getMessagingIfSupported } from '../lib/firebase'
import {
  reconcilePushPermissionFlag,
  resetAndSyncPushTokenForUid,
  syncPushTokenForUid as syncPushTokenCore,
  type PushSyncResult,
} from '../lib/pushTokenSync'

const LS_SETTINGS = 'tether_notification_settings'

export interface NotificationSettings {
  message: boolean
  status: boolean
  diary: boolean
  sound?: 'waterDrop' | 'chime' | 'sparkle' | 'softBell' | 'gentleKnock' | 'silent'
}

const DEFAULT_SETTINGS: NotificationSettings = {
  message: true,
  status: true,
  diary: true,
  sound: 'waterDrop',
}

// 권한 요청 후 FCM 토큰을 발급·저장한다 (WI #22 진단용 export)
export async function requestAndSavePushToken(uid: string): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (!('serviceWorker' in navigator)) return false
  if (!canRequestPushPermission()) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const result = await syncPushTokenCore(uid)
  return result.ok
}

// 이미 권한이 허용된 기기의 FCM 토큰을 현재 user 문서에 다시 저장한다
export async function syncPushTokenForUid(uid: string | null): Promise<boolean> {
  const result = await syncPushTokenCore(uid)
  return result.ok
}

export { syncPushTokenCore, resetAndSyncPushTokenForUid, reconcilePushPermissionFlag }
export type { PushSyncResult }

export function usePushNotification(uid: string | null) {
  const syncToken = useCallback(async (forceRefresh = false): Promise<PushSyncResult> => {
    if (!uid) {
      console.warn('[Push] uid 없음 — syncToken 건너뜀')
      return { ok: false, token: null, reason: 'no_uid' }
    }
    if (forceRefresh) {
      return resetAndSyncPushTokenForUid(uid, 'settings_resync')
    }
    return syncPushTokenCore(uid)
  }, [uid])

  const requestPermission = useCallback(async (): Promise<'granted' | 'denied' | 'blocked'> => {
    if (!('Notification' in window)) return 'denied'
    if (!uid) return 'denied'
    if (!canRequestPushPermission()) return 'blocked'

    if (Notification.permission === 'granted') {
      await syncPushTokenCore(uid)
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      reconcilePushPermissionFlag()
      console.warn('[Push] notifications blocked in browser settings')
      return 'denied'
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      reconcilePushPermissionFlag()
      console.warn('[Push] 권한 거부:', permission)
      return 'denied'
    }

    await syncPushTokenCore(uid)
    return 'granted'
  }, [uid])

  const onForegroundMessage = useCallback(async (
    callback: (payload: MessagePayload) => void,
  ): Promise<() => void> => {
    try {
      const messaging = await getMessagingIfSupported()
      if (!messaging) return () => {}
      return onMessage(messaging, callback)
    } catch {
      return () => {}
    }
  }, [])

  const isGranted = useCallback(() => reconcilePushPermissionFlag(), [])

  const loadSettings = useCallback((): NotificationSettings => {
    try {
      return JSON.parse(localStorage.getItem(LS_SETTINGS) ?? '') as NotificationSettings
    } catch {
      return DEFAULT_SETTINGS
    }
  }, [])

  // 서버(users 문서)를 원본으로 삼아 로컬 캐시를 맞춘다.
  //
  // 알림 설정은 커플 전체에 영향을 주는 값인데(서버가 이걸 보고 푸시를 보낼지 정한다),
  // 예전에는 localStorage만 읽어 화면을 그렸다. 그래서 오래된 로컬값을 가진 기기에서
  // 소리만 바꿔도 전체 설정이 통째로 서버에 덮어써져, 켜둔 줄 알았던 메시지 알림이
  // 조용히 꺼지는 일이 생겼다. 이제 항상 서버 값을 먼저 읽는다.
  const syncSettingsFromServer = useCallback(async (): Promise<NotificationSettings> => {
    const cached = loadSettings()
    if (!uid) return cached
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      const remote = snap.data()?.notificationSettings as Partial<NotificationSettings> | undefined
      if (!remote) return cached
      const merged: NotificationSettings = { ...DEFAULT_SETTINGS, ...remote }
      localStorage.setItem(LS_SETTINGS, JSON.stringify(merged))
      return merged
    } catch {
      return cached
    }
  }, [uid, loadSettings])

  const saveSettings = useCallback(async (settings: NotificationSettings): Promise<void> => {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings))
    if (!uid) return
    try {
      await updateDoc(doc(db, 'users', uid), { notificationSettings: settings })
    } catch { /* ignore */ }
  }, [uid])

  return useMemo(() => ({
    requestPermission,
    syncToken,
    onForegroundMessage,
    isGranted,
    loadSettings,
    syncSettingsFromServer,
    saveSettings,
  }), [
    requestPermission, syncToken, onForegroundMessage, isGranted,
    loadSettings, syncSettingsFromServer, saveSettings,
  ])
}

export function isIOSBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  if ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone) {
    return true
  }
  return window.matchMedia('(display-mode: standalone)').matches
}

// iOS Safari 탭에서는 push permission 요청을 막고 standalone PWA에서만 허용한다
export function canRequestPushPermission(): boolean {
  if (getPushPermissionBlockReason() !== null) return false
  return true
}

export function getPushPermissionBlockReason(): 'unsupported' | 'ios_not_standalone' | null {
  if (typeof window === 'undefined') return 'unsupported'
  if (!('Notification' in window)) return 'unsupported'
  if (!('serviceWorker' in navigator)) return 'unsupported'
  if (isIOSBrowser() && !isStandalonePwa()) return 'ios_not_standalone'
  return null
}
