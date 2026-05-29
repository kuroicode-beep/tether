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
async function getMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null

  try {
    let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
    if (!registration) {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    }

    registration.active?.postMessage({
      type: 'FIREBASE_CONFIG',
      config: {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
        appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
      },
    })

    await navigator.serviceWorker.ready
    return registration
  } catch (error) {
    console.warn('[usePushNotification] SW registration failed', error)
    return null
  }
}

// FCM 토큰을 발급하고 Firestore users 문서에 저장한다
async function syncFcmToken(uid: string | null): Promise<string | null> {
  try {
    const messaging = await getMessagingIfSupported()
    if (!messaging || !VAPID_KEY) return null

    const swReg = await getMessagingServiceWorker()
    if (!swReg) return null

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })

    if (uid && token) {
      await updateDoc(doc(db, 'users', uid), { fcmToken: token })
    }

    if (token) localStorage.setItem(LS_GRANTED, 'true')
    return token
  } catch (error) {
    console.warn('[usePushNotification] syncFcmToken failed', error)
    return null
  }
}

export function usePushNotification(uid: string | null) {
  const syncToken = async (): Promise<string | null> => {
    if (!uid) return null
    return syncFcmToken(uid)
  }

  const requestPermission = async (): Promise<'granted' | 'denied'> => {
    if (!('Notification' in window)) return 'denied'

    if (Notification.permission === 'granted') {
      await syncFcmToken(uid)
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      console.warn('[usePushNotification] notifications blocked in browser settings')
      return 'denied'
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'

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
