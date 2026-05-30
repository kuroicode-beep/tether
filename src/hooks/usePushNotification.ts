// src/hooks/usePushNotification.ts
// FCM 토큰 요청, 포그라운드 메시지, 알림 설정 관리
import { getToken, onMessage, MessagePayload } from 'firebase/messaging'
import { doc, updateDoc } from 'firebase/firestore'
import { db, VAPID_KEY, getMessagingIfSupported } from '../lib/firebase'

const LS_GRANTED = 'tether_fcm_granted'
const LS_SETTINGS = 'tether_notification_settings'

export interface NotificationSettings {
  message: boolean
  status: boolean
  diary: boolean
}

const DEFAULT_SETTINGS: NotificationSettings = {
  message: true,
  status: true,
  diary: true,
}

// FCM 전용 service worker를 등록하고 registration을 반환한다
async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  console.log('[Push] SW support:', 'serviceWorker' in navigator)
  console.log('[Push] Notification support:', 'Notification' in window)
  console.log('[Push] Permission:', typeof Notification !== 'undefined' ? Notification.permission : 'N/A')

  if (!('serviceWorker' in navigator)) {
    console.warn('[Push] ServiceWorker 미지원')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    })
    await navigator.serviceWorker.ready
    console.log('[Push] SW registered:', registration.scope)
    return registration
  } catch (error) {
    console.error('[Push] SW registration failed:', error)
    return null
  }
}

// FCM 토큰을 발급하고 Firestore users 문서에 저장한다
async function syncFcmToken(uid: string | null): Promise<string | null> {
  try {
    if (!VAPID_KEY) {
      console.error('[Push] VAPID 키 없음 — VITE_FIREBASE_VAPID_KEY 확인')
      return null
    }

    const messaging = await getMessagingIfSupported()
    if (!messaging) {
      console.warn('[Push] FCM 미지원 브라우저')
      return null
    }

    const registration = await registerMessagingServiceWorker()
    if (!registration) return null

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    console.log('[Push] FCM token:', token ? `${token.substring(0, 20)}...` : 'FAILED')

    if (!token) {
      console.error('[Push] 토큰 발급 실패 — VAPID 키 또는 SW 확인')
      return null
    }

    if (uid) {
      await updateDoc(doc(db, 'users', uid), {
        fcmToken: token,
        fcmUpdatedAt: new Date().toISOString(),
      })
      console.log('[Push] Token saved to Firestore')
    }

    localStorage.setItem(LS_GRANTED, 'true')
    return token
  } catch (error) {
    console.error('[Push] 오류:', error)
    return null
  }
}

// 권한 요청 후 FCM 토큰을 발급·저장한다 (WI #22 진단용 export)
export async function requestAndSavePushToken(uid: string): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[Push] Notification API 미지원')
    return false
  }
  if (!('serviceWorker' in navigator)) {
    console.warn('[Push] ServiceWorker 미지원')
    return false
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    console.warn('[Push] 권한 거부:', permission)
    return false
  }

  const token = await syncFcmToken(uid)
  return Boolean(token)
}

export function usePushNotification(uid: string | null) {
  const syncToken = async (): Promise<string | null> => {
    if (!uid) {
      console.warn('[Push] uid 없음 — syncToken 건너뜀')
      return null
    }
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      console.warn('[Push] permission not granted:', Notification.permission)
      return null
    }
    return syncFcmToken(uid)
  }

  const requestPermission = async (): Promise<'granted' | 'denied'> => {
    if (!('Notification' in window)) return 'denied'
    if (!uid) return 'denied'

    if (Notification.permission === 'granted') {
      await syncFcmToken(uid)
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      console.warn('[Push] notifications blocked in browser settings')
      return 'denied'
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.warn('[Push] 권한 거부:', permission)
      return 'denied'
    }

    await syncFcmToken(uid)
    return 'granted'
  }

  const onForegroundMessage = async (
    callback: (payload: MessagePayload) => void,
  ): Promise<() => void> => {
    try {
      const messaging = await getMessagingIfSupported()
      if (!messaging) return () => {}
      return onMessage(messaging, callback)
    } catch {
      return () => {}
    }
  }

  const isGranted = () => localStorage.getItem(LS_GRANTED) === 'true'

  const loadSettings = (): NotificationSettings => {
    try {
      return JSON.parse(localStorage.getItem(LS_SETTINGS) ?? '') as NotificationSettings
    } catch {
      return DEFAULT_SETTINGS
    }
  }

  const saveSettings = async (settings: NotificationSettings): Promise<void> => {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings))
    if (!uid) return
    try {
      await updateDoc(doc(db, 'users', uid), { notificationSettings: settings })
    } catch { /* ignore */ }
  }

  return { requestPermission, syncToken, onForegroundMessage, isGranted, loadSettings, saveSettings }
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
