// src/lib/firebase.ts
// Firebase 초기화 + Auth Persistence 명시 설정
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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
