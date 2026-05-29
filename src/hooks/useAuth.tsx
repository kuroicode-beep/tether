// src/hooks/useAuth.tsx
// 전역 Auth 상태 관리: redirect 안전 처리 + 익명→Google 자동 승격
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react'
import {
  AuthError,
  GoogleAuthProvider,
  getRedirectResult,
  linkWithPopup,
  linkWithRedirect,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  User,
} from 'firebase/auth'
import { auth, googleProvider, isMobile } from '../lib/firebase'
import {
  createOrGetUserDoc,
  getMyCoupleId,
  restoreConnectionFromProfile,
  RestoredConnection,
} from '../lib/coupleAuth'

type AuthContextValue = {
  user: User | null
  coupleId: string | null | undefined
  connection: RestoredConnection | null
  loading: boolean
  redirecting: boolean
  authError: string | null
  setCoupleId: (nextCoupleId: string | null) => Promise<void>
  linkGoogle: () => Promise<void>
  signInWithGoogle: () => Promise<User | null>
  signInAnon: () => Promise<User>
  isGoogleLinked: boolean
  clearAuthError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const REDIRECTING_KEY = 'tether_auth_redirecting'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [coupleId, setCoupleIdState] = useState<string | null | undefined>(undefined)
  const [connection, setConnection] = useState<RestoredConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(REDIRECTING_KEY) === '1'
    } catch {
      return false
    }
  })
  const [authError, setAuthError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  // redirect 진입 직전과 복귀 후 sessionStorage를 동기화한다.
  const markRedirecting = (next: boolean) => {
    setRedirecting(next)
    try {
      if (next) sessionStorage.setItem(REDIRECTING_KEY, '1')
      else sessionStorage.removeItem(REDIRECTING_KEY)
    } catch { /* ignore */ }
  }

  // 인증된 사용자에 맞춰 user 문서 / coupleId / connection 상태를 동기화한다.
  const syncProfile = async (nextUser: User | null) => {
    if (!nextUser) {
      setUser(null)
      setCoupleIdState(null)
      setConnection(null)
      return null
    }

    try {
      await createOrGetUserDoc(
        nextUser.uid,
        nextUser.displayName,
        nextUser.isAnonymous ? '나' : undefined,
      )
    } catch (error) {
      console.warn('[useAuth] createOrGetUserDoc failed', error)
    }

    let nextCoupleId: string | null = null
    try {
      nextCoupleId = await getMyCoupleId(nextUser.uid)
    } catch (error) {
      console.warn('[useAuth] getMyCoupleId failed', error)
    }

    if (!nextCoupleId) {
      setUser(nextUser)
      setCoupleIdState(null)
      setConnection(null)
      return null
    }

    let restored: RestoredConnection | null = null
    try {
      restored = await restoreConnectionFromProfile(nextUser.uid)
    } catch (error) {
      console.warn('[useAuth] restoreConnectionFromProfile failed', error)
    }

    if (!restored) {
      // coupleId는 있지만 couples 문서나 partner 정보를 못 읽은 경우 — 일단 user만 유지하고
      // OnboardingScreen으로 보내 사용자가 다시 흐름을 탈 수 있게 한다.
      setUser(nextUser)
      setCoupleIdState(null)
      setConnection(null)
      return null
    }

    setUser(nextUser)
    setCoupleIdState(restored.coupleId)
    setConnection(restored)
    return restored.coupleId
  }

  useEffect(() => {
    cancelledRef.current = false
    let unsub: (() => void) | undefined

    const init = async () => {
      // ① redirect 결과 우선 처리
      try {
        const redirectResult = await getRedirectResult(auth)
        if (cancelledRef.current) return

        if (redirectResult?.user) {
          markRedirecting(false)
          await syncProfile(redirectResult.user)
          if (!cancelledRef.current) setLoading(false)
          return
        }
      } catch (error) {
        const code = (error as AuthError)?.code ?? ''
        // 익명 사용자가 이미 동일 Google 계정과 연결된 경우 fallback으로 Google 직접 로그인 처리
        if (code === 'auth/credential-already-in-use') {
          const credential = GoogleAuthProvider.credentialFromError(error as AuthError)
          if (credential) {
            try {
              const result = await signInWithCredential(auth, credential)
              markRedirecting(false)
              await syncProfile(result.user)
              if (!cancelledRef.current) setLoading(false)
              return
            } catch (innerError) {
              console.warn('[useAuth] signInWithCredential fallback failed', innerError)
            }
          }
        }
        console.warn('[useAuth] getRedirectResult failed', error)
        if (code) setAuthError(`로그인을 마무리하지 못했어요 (${code})`)
      }

      if (cancelledRef.current) return

      // ② 영속 auth 상태 구독
      unsub = onAuthStateChanged(auth, async (nextUser) => {
        if (cancelledRef.current) return
        markRedirecting(false)
        setCoupleIdState(undefined)
        await syncProfile(nextUser)
        if (!cancelledRef.current) setLoading(false)
      })
    }

    init()

    return () => {
      cancelledRef.current = true
      unsub?.()
    }
  }, [])

  // OnboardingScreen / SettingsScreen에서 직접 coupleId를 설정할 때 사용
  const setCoupleId = async (nextCoupleId: string | null) => {
    setCoupleIdState(nextCoupleId)
    if (!auth.currentUser || !nextCoupleId) {
      setConnection(null)
      return
    }

    try {
      const restored = await restoreConnectionFromProfile(auth.currentUser.uid)
      setConnection(restored)
    } catch (error) {
      console.warn('[useAuth] setCoupleId restore failed', error)
      setConnection(null)
    }
  }

  // 현재 사용자에 Google 계정을 연결한다. 이미 사용 중인 자격이면 Google 직접 로그인으로 fallback
  const linkGoogle = async () => {
    if (!auth.currentUser) throw new Error('로그인 정보가 없습니다.')

    try {
      if (isMobile()) {
        markRedirecting(true)
        await linkWithRedirect(auth.currentUser, googleProvider)
        return
      }

      const result = await linkWithPopup(auth.currentUser, googleProvider)
      await syncProfile(result.user)
    } catch (error) {
      const code = (error as AuthError)?.code ?? ''
      if (code === 'auth/provider-already-linked') return

      // Google 자격이 이미 다른 계정에 사용 중이면 그쪽 계정으로 직접 로그인한다
      if (code === 'auth/credential-already-in-use') {
        const credential = GoogleAuthProvider.credentialFromError(error as AuthError)
        if (credential) {
          try {
            const result = await signInWithCredential(auth, credential)
            markRedirecting(false)
            await syncProfile(result.user)
            return
          } catch (innerError) {
            console.warn('[useAuth] credential signin failed', innerError)
          }
        }

        if (isMobile()) {
          markRedirecting(true)
          await signInWithRedirect(auth, googleProvider)
        } else {
          const result = await signInWithPopup(auth, googleProvider)
          await syncProfile(result.user)
        }
        return
      }

      markRedirecting(false)
      throw error
    } finally {
      if (!isMobile()) markRedirecting(false)
    }
  }

  // OnboardingScreen에서 호출. 익명 상태면 link, 아니면 직접 로그인.
  const signInWithGoogle = async () => {
    try {
      if (auth.currentUser?.isAnonymous) {
        if (isMobile()) {
          markRedirecting(true)
          await linkWithRedirect(auth.currentUser, googleProvider)
          return null
        }

        try {
          const result = await linkWithPopup(auth.currentUser, googleProvider)
          await syncProfile(result.user)
          return result.user
        } catch (error) {
          const code = (error as AuthError)?.code ?? ''
          if (code === 'auth/credential-already-in-use') {
            const credential = GoogleAuthProvider.credentialFromError(error as AuthError)
            if (credential) {
              const result = await signInWithCredential(auth, credential)
              await syncProfile(result.user)
              return result.user
            }
          }
          throw error
        }
      }

      if (isMobile()) {
        markRedirecting(true)
        await signInWithRedirect(auth, googleProvider)
        return null
      }

      const result = await signInWithPopup(auth, googleProvider)
      await syncProfile(result.user)
      return result.user
    } catch (error) {
      markRedirecting(false)
      throw error
    }
  }

  // 닉네임 시작 — 익명 인증
  const signInAnon = async () => {
    const result = await signInAnonymously(auth)
    await syncProfile(result.user)
    return result.user
  }

  const clearAuthError = () => setAuthError(null)

  const isGoogleLinked =
    user?.providerData.some((provider) => provider.providerId === 'google.com') ?? false

  return (
    <AuthContext.Provider
      value={{
        user,
        coupleId,
        connection,
        loading,
        redirecting,
        authError,
        setCoupleId,
        linkGoogle,
        signInWithGoogle,
        signInAnon,
        isGoogleLinked,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
