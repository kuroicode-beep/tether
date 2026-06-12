// src/lib/pushTokenSync.ts
// FCM 토큰 발급·Firestore 저장·자동 재동기화 (재연결/SW 갱신 대응)
import { getToken } from 'firebase/messaging'
import { doc, updateDoc } from 'firebase/firestore'
import { db, VAPID_KEY, getMessagingIfSupported } from './firebase'
import { debugLog } from './debugLog'

const LS_GRANTED = 'tether_fcm_granted'
const LS_DEVICE_ID = 'tether_push_device_id'

export type PushSyncResult = {
  ok: boolean
  token: string | null
  reason?: string
}

// 브라우저/PWA 설치 단위로 안정적인 deviceId를 반환한다
export function getPushDeviceId(): string {
  const stored = localStorage.getItem(LS_DEVICE_ID)
  if (stored) return stored

  const random = crypto.randomUUID().replace(/-/g, '')
  const deviceId = `web_${random}`
  localStorage.setItem(LS_DEVICE_ID, deviceId)
  return deviceId
}

// localStorage 플래그와 실제 Notification.permission을 맞춘다
export function reconcilePushPermissionFlag(): boolean {
  const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted'
  if (granted) {
    localStorage.setItem(LS_GRANTED, 'true')
  } else {
    localStorage.removeItem(LS_GRANTED)
  }
  return granted
}

// VitePWA root SW(/sw.js) registration을 반환한다
async function getMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.ready
  } catch (error) {
    console.error('[Push] SW ready failed:', error)
    return null
  }
}

// FCM 토큰을 Firestore users 문서에 저장한다
async function persistToken(uid: string, token: string): Promise<void> {
  const deviceId = getPushDeviceId()
  await updateDoc(doc(db, 'users', uid), {
    fcmToken: token,
    [`fcmTokens.${deviceId}`]: token,
    fcmUpdatedAt: new Date().toISOString(),
  })
}

// FCM 토큰 발급 + Firestore 저장 (재시도 포함)
export async function syncPushTokenForUid(uid: string | null, attempt = 1): Promise<PushSyncResult> {
  if (!uid) {
    return { ok: false, token: null, reason: 'no_uid' }
  }
  if (!('Notification' in window)) {
    return { ok: false, token: null, reason: 'no_notification_api' }
  }
  if (Notification.permission !== 'granted') {
    reconcilePushPermissionFlag()
    return { ok: false, token: null, reason: `permission_${Notification.permission}` }
  }
  if (!VAPID_KEY) {
    debugLog('pushTokenSync.ts', 'no_vapid', {}, 'H3')
    return { ok: false, token: null, reason: 'no_vapid' }
  }

  try {
    const messaging = await getMessagingIfSupported()
    if (!messaging) {
      return { ok: false, token: null, reason: 'messaging_unsupported' }
    }

    const registration = await getMessagingServiceWorker()
    if (!registration) {
      return { ok: false, token: null, reason: 'sw_not_ready' }
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    if (!token) {
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 400))
        return syncPushTokenForUid(uid, attempt + 1)
      }
      return { ok: false, token: null, reason: 'token_empty' }
    }

    await persistToken(uid, token)
    reconcilePushPermissionFlag()
    console.log('[Push] Token saved to Firestore', {
      uid: `${uid.slice(0, 6)}…`,
      deviceId: getPushDeviceId(),
      token: `${token.slice(0, 12)}…`,
    })
    debugLog('pushTokenSync.ts', 'sync_ok', { deviceId: getPushDeviceId() }, 'H3')
    return { ok: true, token }
  } catch (error) {
    const code = (error as { code?: string })?.code ?? 'unknown'
    console.error('[Push] sync failed:', error)
    debugLog('pushTokenSync.ts', 'sync_fail', { code, attempt }, 'H3')
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500))
      return syncPushTokenForUid(uid, attempt + 1)
    }
    return { ok: false, token: null, reason: code }
  }
}

type AutoSyncOptions = {
  uid: string | null
  coupleId: string | null
  status: string
  isLoading: boolean
  sync: () => Promise<PushSyncResult>
}

// 세션/커플/SW 변경 시 FCM 토큰을 자동 재동기화한다
export function installPushTokenAutoSync(options: AutoSyncOptions): () => void {
  const run = () => {
    if (!options.uid) return
    if (options.isLoading) return
    if (options.status !== 'connected' && options.status !== 'no_couple') return
    if (!reconcilePushPermissionFlag()) return
    void options.sync()
  }

  run()

  const onVisible = () => {
    if (document.visibilityState === 'visible') run()
  }

  const onFocus = () => run()

  const onControllerChange = () => {
    console.log('[Push] SW controller changed — resync token')
    run()
  }

  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onFocus)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
  }

  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onFocus)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }
}
