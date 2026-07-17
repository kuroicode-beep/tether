// src/lib/pushTokenSync.ts
// FCM 토큰 발급·Firestore 저장·자동 재동기화 (재연결/SW 갱신 대응)
import { deleteToken, getToken } from 'firebase/messaging'
import { deleteField, doc, updateDoc } from 'firebase/firestore'
import { db, VAPID_KEY, getMessagingIfSupported } from './firebase'
import { debugLog } from './debugLog'

const LS_GRANTED = 'tether_fcm_granted'
const LS_DEVICE_ID = 'tether_push_device_id'
const LS_SYNC_TS = 'tether_fcm_sync_ts'

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7일 — FCM 토큰 강제 갱신 주기

function isTokenStale(): boolean {
  const ts = localStorage.getItem(LS_SYNC_TS)
  if (!ts) return true
  return Date.now() - Number(ts) > TOKEN_TTL_MS
}

function markTokenSynced(): void {
  localStorage.setItem(LS_SYNC_TS, String(Date.now()))
}

export type PushSyncResult = {
  ok: boolean
  token: string | null
  reason?: string
}

type PushSyncOptions = {
  forceRefresh?: boolean
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

// 현재 설치의 기존 FCM 토큰을 폐기하고 Firestore의 현재 deviceId 슬롯을 비운다
async function resetCurrentDeviceToken(uid: string): Promise<void> {
  const messaging = await getMessagingIfSupported()
  if (!messaging) return

  try {
    await deleteToken(messaging)
  } catch (error) {
    debugLog('pushTokenSync.ts', 'delete_token_skip', {
      code: (error as { code?: string })?.code ?? 'unknown',
    }, 'H3')
  }

  try {
    const deviceId = getPushDeviceId()
    await updateDoc(doc(db, 'users', uid), {
      [`fcmTokens.${deviceId}`]: deleteField(),
      fcmToken: deleteField(),
      fcmUpdatedAt: new Date().toISOString(),
    })
  } catch (error) {
    debugLog('pushTokenSync.ts', 'clear_device_token_skip', {
      code: (error as { code?: string })?.code ?? 'unknown',
    }, 'H3')
  }
}

// FCM 토큰 발급 + Firestore 저장 (재시도 포함)
export async function syncPushTokenForUid(
  uid: string | null,
  options: PushSyncOptions = {},
  attempt = 1,
): Promise<PushSyncResult> {
  if (!uid) {
    return { ok: false, token: null, reason: 'no_uid' }
  }
  // 사이드카가 알림을 담당 중이면 이 기기 토큰 재등록을 막는다 (수동 재등록은 허용)
  if (sidecarSuppressed && !options.forceRefresh) {
    return { ok: false, token: null, reason: 'sidecar_active' }
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

    if (options.forceRefresh && attempt === 1) {
      await resetCurrentDeviceToken(uid)
    }

    const registration = await getMessagingServiceWorker()
    if (!registration) {
      return { ok: false, token: null, reason: 'sw_not_ready' }
    }

    // 7일 이상 된 토큰은 FCM에서 조용히 만료될 수 있으므로 강제 재발급한다
    if (isTokenStale()) {
      try {
        await deleteToken(messaging)
        console.log('[Push] Forced token refresh (stale >', TOKEN_TTL_MS / 86400000, 'days)')
      } catch { /* 이미 없는 토큰이면 무시 */ }
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    if (!token) {
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 400))
        return syncPushTokenForUid(uid, options, attempt + 1)
      }
      return { ok: false, token: null, reason: 'token_empty' }
    }

    await persistToken(uid, token)
    markTokenSynced()
    reconcilePushPermissionFlag()
    console.log('[Push] Token saved to Firestore', {
      uid: `${uid.slice(0, 6)}…`,
      deviceId: getPushDeviceId(),
      token: `${token.slice(0, 12)}…`,
      forceRefresh: options.forceRefresh === true,
      reason: options.reason ?? 'sync',
    })
    debugLog('pushTokenSync.ts', 'sync_ok', {
      deviceId: getPushDeviceId(),
      forceRefresh: options.forceRefresh === true,
      reason: options.reason ?? 'sync',
    }, 'H3')
    return { ok: true, token }
  } catch (error) {
    const code = (error as { code?: string })?.code ?? 'unknown'
    console.error('[Push] sync failed:', error)
    debugLog('pushTokenSync.ts', 'sync_fail', { code, attempt }, 'H3')
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500))
      return syncPushTokenForUid(uid, options, attempt + 1)
    }
    return { ok: false, token: null, reason: code }
  }
}

// 재설치/재연결 직후 현재 설치의 FCM 토큰을 강제로 새로 발급해 저장한다
export async function resetAndSyncPushTokenForUid(
  uid: string | null,
  reason = 'manual_reset',
): Promise<PushSyncResult> {
  return syncPushTokenForUid(uid, { forceRefresh: true, reason })
}

type AutoSyncOptions = {
  uid: string | null
  coupleId: string | null
  status: string
  isLoading: boolean
  sync: () => Promise<PushSyncResult>
}

// ─── 사이드카 감지 (Windows 상주 알림 앱과 중복 방지) ─────────────────────

const SIDECAR_PING_URL = 'http://127.0.0.1:48620/ping'
let sidecarSuppressed = false

// 로컬 사이드카가 살아있는지 확인한다 (미실행/타 플랫폼이면 빠르게 실패)
async function detectSidecar(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1200)
    const res = await fetch(SIDECAR_PING_URL, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return false
    const data = await res.json() as { app?: string }
    return data.app === 'tether-sidecar'
  } catch {
    return false
  }
}

// 사이드카 실행 중이면 이 기기의 FCM 토큰을 해제해 크롬 중복 알림을 막는다
async function reconcileSidecar(uid: string, sync: () => Promise<PushSyncResult>): Promise<void> {
  const active = await detectSidecar()

  if (active) {
    if (!sidecarSuppressed) {
      sidecarSuppressed = true
      console.log('[Push] sidecar detected — releasing this device FCM token')
      debugLog('pushTokenSync.ts', 'sidecar_suppress', {}, 'H3')
      await resetCurrentDeviceToken(uid)
    }
    return
  }

  if (sidecarSuppressed) {
    sidecarSuppressed = false
    console.log('[Push] sidecar gone — restoring FCM token')
    debugLog('pushTokenSync.ts', 'sidecar_restore', {}, 'H3')
  }
  void sync()
}

// 세션/커플/SW 변경 시 FCM 토큰을 자동 재동기화한다
export function installPushTokenAutoSync(options: AutoSyncOptions): () => void {
  const run = () => {
    if (!options.uid) return
    if (options.isLoading) return
    if (options.status !== 'connected' && options.status !== 'no_couple') return
    if (!reconcilePushPermissionFlag()) return
    void reconcileSidecar(options.uid, options.sync)
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
