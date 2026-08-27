// src/lib/firebase.ts
// Firebase 초기화 + Auth Persistence 명시 설정
import { initializeApp } from 'firebase/app'
import {
  clearIndexedDbPersistence,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
} from 'firebase/firestore'
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'
import { getMessaging, isSupported } from 'firebase/messaging'

export const isMobile = () =>
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

export const isAndroid = () =>
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

export const isAndroidChrome = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Android/i.test(ua) && /Chrome/i.test(ua) && !/Edg|OPR|SamsungBrowser/i.test(ua)
}


// Google OAuth redirect URI는 firebaseapp.com에 등록되어 있다. web.app authDomain은 Console 등록 전 사용 금지.
const resolveAuthDomain = (projectId: string, configured?: string): string =>
  configured || `${projectId}.firebaseapp.com`

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  ),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missingKeys.length > 0) {
  throw new Error(`Firebase environment is missing: ${missingKeys.join(', ')}`)
}

const app = initializeApp(firebaseConfig)

export { app }

function createFirestoreDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  } catch (error) {
    console.warn('[firebase] persistent Firestore cache unavailable, falling back to memory cache', error)
    return getFirestore(app)
  }
}

export const db = createFirestoreDb()

// 채팅 초기화로 서버에서 대량 삭제된 문서가 로컬 IndexedDB 캐시에는 그대로 남아,
// 쿼리마다 메인 스레드에서 유령 문서 수만 건을 스캔하며 느려진다. 남은 캐시로는
// 삭제된 대화가 계속 보이기도 한다. 앱 시작 시 1회만 캐시를 비우고 새로고침해 다시 채운다.
// 대량 삭제를 또 하면 이 키의 날짜를 그날짜로 바꿔야 모든 기기에서 재퍼지된다.
const CACHE_PURGE_KEY = 'tether:fscache-purged:2026-08-27'

// 캐시를 정리했으면 true를 반환한다 (호출부는 렌더를 멈추고 reload를 기다린다)
export async function purgeStaleFirestoreCacheOnce(): Promise<boolean> {
  try {
    if (localStorage.getItem(CACHE_PURGE_KEY)) return false
    // 실패해도 재시도 루프에 빠지지 않도록 플래그를 먼저 기록한다
    localStorage.setItem(CACHE_PURGE_KEY, String(Date.now()))
    await terminate(db)
    await clearIndexedDbPersistence(db)
    window.location.reload()
    return true
  } catch (err) {
    // 다른 탭이 캐시를 점유 중이면 정리를 건너뛰고 그대로 진행한다
    console.warn('[firebase] stale cache purge skipped', err)
    return false
  }
}

// 방금 대량 삭제를 한 기기에서 플래그와 무관하게 캐시를 즉시 비우고 새로고침한다.
// (설정의 "채팅 기록 전체 삭제" 완료 직후 호출한다)
export async function purgeFirestoreCacheNow(): Promise<void> {
  // 재퍼지 대상이 이미 정리됐으므로 1회성 플래그도 채워 둔다
  try {
    localStorage.setItem(CACHE_PURGE_KEY, String(Date.now()))
  } catch {
    // 저장 실패는 무시한다 — 퍼지 자체를 막을 이유가 없다
  }
  await terminate(db)
  await clearIndexedDbPersistence(db)
  window.location.reload()
}

export const storage = getStorage(app)

// Android Chrome / iOS Safari의 cross-site storage 제한 환경에서도 redirect 토큰이
// 유실되지 않도록 IndexedDB → LocalStorage 순서로 영속성을 명시한다.
// 이 설정을 하지 않으면 redirect 복귀 시 getRedirectResult()가 null을 반환하면서
// 로그인 무한 루프가 발생할 수 있다.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
})

export const functions = getFunctions(app, 'us-central1')


export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? ''

export async function getMessagingIfSupported() {
  try {
    const supported = await isSupported()
    if (!supported) return null
    return getMessaging(app)
  } catch {
    return null
  }
}
