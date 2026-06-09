// src/hooks/useAuth.tsx
// 전역 Auth 상태 관리: redirect 안전 처리 + 익명→Google 자동 승격
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react'
import {
  AuthError,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signOut,
  User,
} from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db, isAndroid } from '../lib/firebase'
import { linkGoogleViaGsi, signInWithGoogleViaGsi } from '../lib/googleSignIn'
import {
  createOrGetUserDoc,
  getMyCoupleId,
  restoreConnectionFromProfile,
  RestoredConnection,
} from '../lib/coupleAuth'
import { debugLog } from '../lib/debugLog'

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
    if (code === 'auth/credential-already-in-use') {
      return '이 Google 계정은 이미 등록되어 있어요. 잠시 후 다시 시도해주세요.'
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
      // #region agent log
      debugLog('useAuth.tsx:syncProfile', 'restore failed', { hasCoupleId: Boolean(nextCoupleId) }, 'H1')
      // #endregion
      setUser(nextUser)
      setCoupleIdState(null)
      setConnection(null)
      return null
    }

    // #region agent log
    debugLog('useAuth.tsx:syncProfile', 'profile ok', { hasCouple: true }, 'H1')
    // #endregion
    setUser(nextUser)
    setCoupleIdState(restored.coupleId)
    setConnection(restored)
    return restored.coupleId
  }

  // 탭/PWA 복귀 시 Firestore 프로필을 다시 읽어 멀티 디바이스 동기화를 맞춘다
  useEffect(() => {
    if (!user) return

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void syncProfile(user)
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user])

  // users/{uid}.coupleId 실시간 반영 — PC/폰 전환 시 Auth·AppContext 동기화
  useEffect(() => {
    if (!user) return

    const unsub = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      const nextCoupleId = (snap.data()?.coupleId as string | null | undefined) ?? null
      setCoupleIdState((prev) => {
        if (prev === nextCoupleId) return prev
        return nextCoupleId
      })

      if (!nextCoupleId) {
        setConnection(null)
        return
      }

      try {
        const restored = await restoreConnectionFromProfile(user.uid)
        setConnection(restored)
      } catch (error) {
        console.warn('[useAuth] live coupleId restore failed', error)
      }
    })

    return () => unsub()
  }, [user?.uid])

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

  // Google 자격이 이미 다른 계정에 묶여 있으면 해당 계정으로 로그인한다 (설정 > Google 연결용)
  const signInWithExistingGoogleCredential = async (error: unknown) => {
    const credential = GoogleAuthProvider.credentialFromError(error as AuthError)
    if (!credential) return null
    const result = await signInWithCredential(auth, credential)
    markRedirecting(false)
    await syncProfile(result.user)
    return result.user
  }

  // 설정에서 익명 계정에 Google을 연결한다 (가입 승격)
  const linkGoogle = async () => {
    if (!auth.currentUser) throw new Error('로그인 정보가 없습니다.')

    try {
      const linked = await linkGoogleViaGsi(auth.currentUser)
      await syncProfile(linked)
      markRedirecting(false)
    } catch (error) {
      const code = (error as AuthError)?.code ?? ''
      if (code === 'auth/provider-already-linked') return
      if (code === 'auth/credential-already-in-use') {
        const existing = await signInWithExistingGoogleCredential(error)
        if (existing) return
        // GIS link 오류에는 credential이 없을 수 있음 — 익명 세션 제거 후 로그인
        await signOut(auth)
        const user = await signInWithGoogleViaGsi()
        await syncProfile(user)
        markRedirecting(false)
        return
      }
      markRedirecting(false)
      throw error
    }
  }

  // 온보딩 Google 버튼 — 기존 계정 로그인 (익명 연결/가입 시도 금지)
  const signInWithGoogle = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth)
      }

      const user = await signInWithGoogleViaGsi()
      const cid = await syncProfile(user)
      // #region agent log
      debugLog('useAuth.tsx:signInWithGoogle', 'done', { hasCouple: Boolean(cid) }, 'H1')
      // #endregion
      markRedirecting(false)
      return user
    } catch (error) {
      const code = (error as AuthError)?.code ?? 'unknown'
      // #region agent log
      debugLog('useAuth.tsx:signInWithGoogle', 'fail', { code }, 'H1')
      // #endregion
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
