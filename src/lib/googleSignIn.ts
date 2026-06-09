// src/lib/googleSignIn.ts
// Android 등에서 redirect_uri_mismatch를 피하기 위해 GIS 토큰 → signInWithCredential 사용
import {
  AuthCredential,
  AuthError,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithCredential,
  User,
} from 'firebase/auth'
import { app, auth } from './firebase'

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: (options?: { prompt?: string }) => void }
        }
      }
    }
  }
}

let gsiScriptPromise: Promise<void> | null = null
let cachedWebClientId: string | null = null

// Google Identity Services 스크립트를 한 번만 로드한다
function loadGsiScript(): Promise<void> {
  if (gsiScriptPromise) return gsiScriptPromise

  gsiScriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }

    const existing = document.querySelector('script[data-tether-gsi="1"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google 로그인 스크립트 로드 실패')))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.tetherGsi = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google 로그인 스크립트 로드 실패'))
    document.head.appendChild(script)
  })

  return gsiScriptPromise
}

// Firebase가 사용하는 Web OAuth client ID를 조회한다
async function fetchGoogleWebClientId(): Promise<string> {
  if (cachedWebClientId) return cachedWebClientId

  const envClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID
  if (envClientId) {
    cachedWebClientId = envClientId
    return envClientId
  }

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  if (!apiKey) throw new Error('Firebase API key is missing')

  const continueUri = `${window.location.origin}/`
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: 'google.com',
        continueUri,
        authFlowType: 'CODE_FLOW',
      }),
    },
  )

  if (!response.ok) {
    throw new Error('Google client ID를 가져오지 못했어요')
  }

  const data = (await response.json()) as { authUri?: string }
  const authUri = data.authUri
  if (!authUri) throw new Error('Google client ID를 가져오지 못했어요')

  const clientId = new URL(authUri).searchParams.get('client_id')
  if (!clientId) throw new Error('Google client ID를 가져오지 못했어요')

  cachedWebClientId = clientId
  return clientId
}

// GIS로 Google access token을 받아 Firebase credential로 변환한다
async function requestGoogleCredential(): Promise<AuthCredential> {
  await loadGsiScript()
  const clientId = await fetchGoogleWebClientId()

  const accessToken = await new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error))
          return
        }
        if (!response.access_token) {
          reject(new Error('Google access token missing'))
          return
        }
        resolve(response.access_token)
      },
    })
    client.requestAccessToken({ prompt: 'select_account' })
  })

  return GoogleAuthProvider.credential(null, accessToken)
}

// GIS credential로 Google 로그인
export async function signInWithGoogleViaGsi(): Promise<User> {
  void app
  const credential = await requestGoogleCredential()
  const result = await signInWithCredential(auth, credential)
  return result.user
}

// GIS credential로 익명 계정에 Google 연결
export async function linkGoogleViaGsi(currentUser: User): Promise<User> {
  const credential = await requestGoogleCredential()
  const result = await linkWithCredential(currentUser, credential)
  return result.user
}

// 익명이면 link, 이미 쓰는 Google 계정이면 같은 credential로 sign-in 전환
export async function signInOrLinkGoogleViaGsi(currentUser: User | null): Promise<User> {
  const credential = await requestGoogleCredential()

  if (currentUser?.isAnonymous) {
    try {
      const result = await linkWithCredential(currentUser, credential)
      return result.user
    } catch (error) {
      const code = (error as AuthError)?.code ?? ''
      if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
        const result = await signInWithCredential(auth, credential)
        return result.user
      }
      if (code === 'auth/provider-already-linked') return currentUser
      throw error
    }
  }

  const result = await signInWithCredential(auth, credential)
  return result.user
}
