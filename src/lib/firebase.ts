import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
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

export const db = getFirestore(app)
export const storage = getStorage(app)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

export const isMobile = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

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
