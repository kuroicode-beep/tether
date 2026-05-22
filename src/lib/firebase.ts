import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  // TODO: Firebase 콘솔에서 복사해서 붙여넣기
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
}

// Firebase 미설정 시 데모 모드로 폴백
const isConfigured = !!firebaseConfig.apiKey

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const storage = getStorage(app)

// auth: API 키 없으면 null (데모 모드에서는 coupleAuth가 localStorage로 폴백)
export let auth: ReturnType<typeof getAuth> | null = null
if (isConfigured) {
  try {
    auth = getAuth(app)
  } catch {
    auth = null
  }
}

// FCM VAPID 공개 키 (Firebase 콘솔 → 프로젝트 설정 → 클라우드 메시지 → 웹 앱 → VAPID 키)
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? ''

// FCM Messaging — 브라우저 지원 여부를 런타임에 확인 후 반환
export async function getMessagingIfSupported() {
  try {
    const supported = await isSupported()
    if (!supported) return null
    return getMessaging(app)
  } catch {
    return null
  }
}
