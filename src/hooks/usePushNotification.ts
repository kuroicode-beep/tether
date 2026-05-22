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

export function usePushNotification(uid: string | null) {
  // 권한 요청 + FCM 토큰 Firestore 저장
  const requestPermission = async (): Promise<'granted' | 'denied'> => {
    if (!('Notification' in window)) return 'denied'

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'

    try {
      const messaging = await getMessagingIfSupported()
      if (!messaging || !VAPID_KEY) {
        // Firebase 미설정이어도 권한은 granted로 기록
        localStorage.setItem(LS_GRANTED, 'true')
        return 'granted'
      }

      // Service Worker에 Firebase config 전달
      const swReg = await navigator.serviceWorker.ready
      swReg.active?.postMessage({
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

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      })

      // Firestore users/{uid} 에 fcmToken 저장
      if (uid) {
        await updateDoc(doc(db, 'users', uid), { fcmToken: token })
      }

      localStorage.setItem(LS_GRANTED, 'true')
    } catch {
      // Firebase 미설정 — 로컬만 기록
      localStorage.setItem(LS_GRANTED, 'true')
    }

    return 'granted'
  }

  // 포그라운드 메시지 수신 등록 — unsubscribe 함수 반환
  const onForegroundMessage = async (callback: (payload: MessagePayload) => void): Promise<() => void> => {
    try {
      const messaging = await getMessagingIfSupported()
      if (!messaging) return () => {}
      return onMessage(messaging, callback)
    } catch {
      return () => {}
    }
  }

  const isGranted = () => localStorage.getItem(LS_GRANTED) === 'true'

  // 알림 설정 로드
  const loadSettings = (): NotificationSettings => {
    try {
      return JSON.parse(localStorage.getItem(LS_SETTINGS) ?? '') as NotificationSettings
    } catch {
      return DEFAULT_SETTINGS
    }
  }

  // 알림 설정 저장 (Firestore + localStorage)
  const saveSettings = async (settings: NotificationSettings): Promise<void> => {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings))
    if (!uid) return
    try {
      await updateDoc(doc(db, 'users', uid), { notificationSettings: settings })
    } catch {
      // Firebase 미설정 — 로컬만 저장
    }
  }

  return { requestPermission, onForegroundMessage, isGranted, loadSettings, saveSettings }
}
