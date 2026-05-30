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
import { auth, googleProvider, isAndroid, shouldUseGoogleRedirect } from '../lib/firebase'
import { linkGoogleViaGsi, signInWithGoogleViaGsi } from '../lib/googleSignIn'
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
  isLoading: boolean
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
  const authBootstrappedRef = useRef(false)
  const redirectHandledRef = useRef(false)
  const redirectCheckDoneRef = useRef(false)

  const authLog = (...args: unknown[]) => {
    if (import.meta.env.DEV) console.log('[Auth]', ...args)
  }

  // Firebase Auth 에러 코드를 사용자에게 보여줄 문구로 변환한다
  const toAuthErrorMessage = (error: unknown): string => {
    const code = (error as AuthError)?.code ?? ''
    if (code === 'auth/popup-blocked') {
      if (isAndroid()) {
        return '카카오톡 등 앱 안 브라우저에서는 Google 로그인이 안 될 수 있어요. Chrome에서 tether-d1dab.web.app 을 직접 열어주세요.'
      }
      return '팝업이 차단됐어요. 브라우저 주소창 오른쪽에서 팝업을 허용하거나, 잠시 후 다시 시도해주세요.'
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google 로그인 창이 닫혔어요. 다시 시도해주세요.'
    }
    if (code === 'auth/cancelled-popup-request') {
      return '이미 Google 로그인 창이 열려 있어요. 잠시 후 다시 시도해주세요.'
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Google 로그인이 아직 활성화되지 않았어요. Firebase 콘솔 설정을 확인해주세요.'
    }
    if (code === 'auth/network-request-failed') {
      return '네트워크 연결을 확인한 뒤 다시 시도해주세요.'
    }
    if (code === 'auth/missing-initial-state') {
      return '브라우저 저장소 제한으로 로그인을 이어갈 수 없어요. Chrome에서 tether-d1dab.web.app 을 직접 열고 다시 시도해주세요.'
    }
    if (code === 'auth/unauthorized-domain') {
      return '이 도메인은 Firebase 승인 목록에 없어요. Firebase Console → Authentication → 승인된 도메인을 확인해주세요.'
    }
    const message = error instanceof Error ? error.message : ''
    if (message.includes('access_denied') || message.includes('popup_closed')) {
      return 'Google 로그인 창이 닫혔어요. 다시 시도해주세요.'
    }
    return code
      ? `Google 로그인을 완료하지 못했어요 (${code})`
      : 'Google 로그인을 완료하지 못했어요.'
  }

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
      authLog('getMyCoupleId result:', nextCoupleId)
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
      authLog('init start')

      // ① redirect 결과를 onAuthStateChanged보다 먼저 처리한다 (Android 무한루프 방지)
      try {
        authLog('getRedirectResult start')
        const redirectResult = await getRedirectResult(auth)
        if (cancelledRef.current) return

        authLog('getRedirectResult result:', redirectResult?.user?.uid ?? 'none')

        if (redirectResult?.user) {
          markRedirecting(false)
          await syncProfile(redirectResult.user)
          redirectHandledRef.current = true
          authBootstrappedRef.current = true
          if (!cancelledRef.current) {
            authLog('setLoading false (redirect)')
            setLoading(false)
          }
        }
      } catch (error) {
        const code = (error as AuthError)?.code ?? ''
        if (code === 'auth/credential-already-in-use') {
          const credential = GoogleAuthProvider.credentialFromError(error as AuthError)
          if (credential) {
            try {
              const result = await signInWithCredential(auth, credential)
              markRedirecting(false)
              await syncProfile(result.user)
              redirectHandledRef.current = true
              authBootstrappedRef.current = true
              if (!cancelledRef.current) setLoading(false)
            } catch (innerError) {
              console.warn('[useAuth] signInWithCredential fallback failed', innerError)
            }
          }
        } else {
          console.warn('[useAuth] getRedirectResult failed', error)
          markRedirecting(false)
          if (code === 'auth/missing-initial-state') {
            setAuthError(toAuthErrorMessage(error))
          } else if (code) {
            setAuthError(`로그인을 마무리하지 못했어요 (${code})`)
          }
        }
      } finally {
        redirectCheckDoneRef.current = true
      }

      if (cancelledRef.current) return

      // ② 영속 auth 상태 구독
      unsub = onAuthStateChanged(auth, async (nextUser) => {
        if (cancelledRef.current) return

        authLog('onAuthStateChanged user:', nextUser?.uid ?? 'null')

        if (redirectHandledRef.current) {
          redirectHandledRef.current = false
          authLog('skipping duplicate post-redirect callback')
          return
        }

        let redirectPending = false
        try {
          redirectPending = sessionStorage.getItem(REDIRECTING_KEY) === '1'
        } catch { /* ignore */ }

        // redirect 복귀 직후 auth가 잠깐 null일 수 있음 — getRedirectResult 완료 전까지 대기
        if (!nextUser && redirectPending && !redirectCheckDoneRef.current) {
          authLog('redirect pending, waiting for getRedirectResult')
          return
        }

        if (!nextUser && redirectPending && redirectCheckDoneRef.current) {
          markRedirecting(false)
        }

        if (nextUser) {
          markRedirecting(false)
        }

        if (!authBootstrappedRef.current && nextUser) {
          setCoupleIdState(undefined)
        }

        await syncProfile(nextUser)
        authBootstrappedRef.current = true
        if (!cancelledRef.current) {
          authLog('setLoading false')
          setLoading(false)
        }
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

  // Google 자격이 이미 다른 계정에 묶여 있으면 해당 계정으로 로그인한다
  const signInWithExistingGoogleCredential = async (error: unknown) => {
    const credential = GoogleAuthProvider.credentialFromError(error as AuthError)
    if (!credential) return null
    const result = await signInWithCredential(auth, credential)
    markRedirecting(false)
    await syncProfile(result.user)
    return result.user
  }

  // 현재 사용자에 Google 계정을 연결한다. 이미 사용 중인 자격이면 Google 직접 로그인으로 fallback
  const linkGoogle = async () => {
    if (!auth.currentUser) throw new Error('로그인 정보가 없습니다.')

    try {
      if (isAndroid()) {
        try {
          const linked = await linkGoogleViaGsi(auth.currentUser)
          await syncProfile(linked)
          return
        } catch (error) {
          const code = (error as AuthError)?.code ?? ''
          if (code === 'auth/provider-already-linked') return
          if (code === 'auth/credential-already-in-use') {
            await signInWithExistingGoogleCredential(error)
            return
          }
          throw error
        }
      }

      if (shouldUseGoogleRedirect()) {
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

        if (shouldUseGoogleRedirect()) {
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
      if (!shouldUseGoogleRedirect()) markRedirecting(false)
    }
  }

  // OnboardingScreen에서 호출. 익명 상태면 link, 아니면 직접 로그인.
  const signInWithGoogle = async () => {
    try {
      if (isAndroid()) {
        if (auth.currentUser?.isAnonymous) {
          try {
            const linked = await linkGoogleViaGsi(auth.currentUser)
            await syncProfile(linked)
            return linked
          } catch (error) {
            const code = (error as AuthError)?.code ?? ''
            if (code === 'auth/credential-already-in-use') {
              const existing = await signInWithExistingGoogleCredential(error)
              if (existing) return existing
            }
            throw error
          }
        }

        const user = await signInWithGoogleViaGsi()
        await syncProfile(user)
        return user
      }

      if (auth.currentUser?.isAnonymous) {
        if (shouldUseGoogleRedirect()) {
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
          if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
            if (isAndroid()) throw error
            markRedirecting(true)
            await linkWithRedirect(auth.currentUser, googleProvider)
            return null
          }
          throw error
        }
      }

      if (shouldUseGoogleRedirect()) {
        markRedirecting(true)
        await signInWithRedirect(auth, googleProvider)
        return null
      }

      try {
        const result = await signInWithPopup(auth, googleProvider)
        await syncProfile(result.user)
        return result.user
      } catch (error) {
        const code = (error as AuthError)?.code ?? ''
        if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
          if (isAndroid()) throw error
          markRedirecting(true)
          await signInWithRedirect(auth, googleProvider)
          return null
        }
        throw error
      }
    } catch (error) {
      markRedirecting(false)
      setAuthError(toAuthErrorMessage(error))
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

  const isLoading = loading || coupleId === undefined

  return (
    <AuthContext.Provider
      value={{
        user,
        coupleId,
        connection,
        loading,
        isLoading,
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
