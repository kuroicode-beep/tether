// src/context/SessionContext.tsx
// 단일 세션 source of truth — Auth + users/{uid} + couple 복원
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  AuthError,
  GoogleAuthProvider,
  User,
  getRedirectResult,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db, isAndroid } from '../lib/firebase'
import { linkGoogleViaGsi, signInWithGoogleViaGsi } from '../lib/googleSignIn'
import {
  createOrGetUserDoc,
  isAdminEmail,
  restoreConnectionFromProfile,
  RestoredConnection,
} from '../lib/coupleAuth'
import { debugLog } from '../lib/debugLog'

export type SessionStatus =
  | 'loading'
  | 'signed_out'
  | 'no_couple'
  | 'approval_pending'
  | 'restoring'
  | 'connected'
  | 'restore_failed'

export type SessionState = {
  status: SessionStatus
  user: User | null
  uid: string | null
  coupleId: string | null
  connection: RestoredConnection | null
  error: string | null
}

type SessionContextValue = SessionState & {
  redirecting: boolean
  authError: string | null
  isLoading: boolean
  isGoogleLinked: boolean
  retryRestore: () => Promise<void>
  refreshSession: () => Promise<void>
  signInWithGoogle: () => Promise<User | null>
  signInAnon: () => Promise<User>
  linkGoogle: () => Promise<void>
  signOut: () => Promise<void>
  notifyCoupleLinked: () => Promise<boolean>
  clearAuthError: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)
const REDIRECTING_KEY = 'tether_auth_redirecting'

const INITIAL: SessionState = {
  status: 'loading',
  user: null,
  uid: null,
  coupleId: null,
  connection: null,
  error: null,
}

function toAuthErrorMessage(error: unknown): string {
  const code = (error as AuthError)?.code ?? ''
  if (code === 'auth/popup-blocked') {
    if (isAndroid()) {
      return '카카오톡 등 앱 안 브라우저에서는 Google 로그인이 안 될 수 있어요. Chrome에서 tether-d1dab.web.app 을 직접 열어주세요.'
    }
    return '팝업이 차단됐어요. 브라우저 주소창 오른쪽에서 팝업을 허용하거나, 잠시 후 다시 시도해주세요.'
  }
  if (code === 'auth/popup-closed-by-user') return 'Google 로그인 창이 닫혔어요. 다시 시도해주세요.'
  if (code === 'auth/cancelled-popup-request') return '이미 Google 로그인 창이 열려 있어요. 잠시 후 다시 시도해주세요.'
  if (code === 'auth/operation-not-allowed') return 'Google 로그인이 아직 활성화되지 않았어요.'
  if (code === 'auth/network-request-failed') return '네트워크 연결을 확인한 뒤 다시 시도해주세요.'
  if (code === 'auth/missing-initial-state') {
    return '브라우저 저장소 제한으로 로그인을 이어갈 수 없어요. Chrome에서 tether-d1dab.web.app 을 직접 열고 다시 시도해주세요.'
  }
  if (code === 'auth/unauthorized-domain') return '이 도메인은 Firebase 승인 목록에 없어요.'
  if (code === 'auth/credential-already-in-use') return '이 Google 계정은 이미 등록되어 있어요.'
  const message = error instanceof Error ? error.message : ''
  if (message.includes('access_denied') || message.includes('popup_closed')) {
    return 'Google 로그인 창이 닫혔어요. 다시 시도해주세요.'
  }
  return code ? `Google 로그인을 완료하지 못했어요 (${code})` : 'Google 로그인을 완료하지 못했어요.'
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(INITIAL)
  const [redirecting, setRedirecting] = useState(() => {
    try { return sessionStorage.getItem(REDIRECTING_KEY) === '1' } catch { return false }
  })
  const [authError, setAuthError] = useState<string | null>(null)

  const restoreGenerationRef = useRef(0)
  const profileCoupleIdRef = useRef<string | null>(null)
  const currentUserRef = useRef<User | null>(null)
  const cancelledRef = useRef(false)
  const authBootstrappedRef = useRef(false)
  const redirectHandledRef = useRef(false)
  const redirectCheckDoneRef = useRef(false)

  const markRedirecting = useCallback((next: boolean) => {
    setRedirecting(next)
    try {
      if (next) sessionStorage.setItem(REDIRECTING_KEY, '1')
      else sessionStorage.removeItem(REDIRECTING_KEY)
    } catch { /* ignore */ }
  }, [])

  const restoreForCouple = useCallback(async (uid: string, coupleId: string, user: User) => {
    const generation = ++restoreGenerationRef.current
    setSession((prev) => ({
      ...prev,
      status: 'restoring',
      user,
      uid,
      coupleId,
      connection: null,
      error: null,
    }))

    try {
      const restored = await restoreConnectionFromProfile(uid)
      if (generation !== restoreGenerationRef.current) return

      if (!restored) {
        debugLog('SessionContext:restore', 'failed', { hasCoupleId: true }, 'H1')
        setSession({
          status: 'restore_failed',
          user,
          uid,
          coupleId,
          connection: null,
          error: '커플 정보를 불러오지 못했어요.',
        })
        return
      }

      debugLog('SessionContext:restore', 'ok', { hasCouple: true }, 'H1')
      setSession({
        status: 'connected',
        user,
        uid,
        coupleId: restored.coupleId,
        connection: restored,
        error: null,
      })
    } catch (err) {
      if (generation !== restoreGenerationRef.current) return
      console.warn('[Session] restoreConnectionFromProfile failed', err)
      setSession({
        status: 'restore_failed',
        user,
        uid,
        coupleId,
        connection: null,
        error: err instanceof Error ? err.message : '복원 중 오류가 발생했어요.',
      })
    }
  }, [])

  const sessionStatusRef = useRef(session.status)
  sessionStatusRef.current = session.status

  const applyProfileCoupleId = useCallback((user: User, coupleId: string | null) => {
    if (coupleId && coupleId === profileCoupleIdRef.current && sessionStatusRef.current === 'connected') {
      return
    }

    currentUserRef.current = user
    profileCoupleIdRef.current = coupleId

    if (!coupleId) {
      restoreGenerationRef.current += 1
      setSession({
        status: 'no_couple',
        user,
        uid: user.uid,
        coupleId: null,
        connection: null,
        error: null,
      })
      return
    }

    void restoreForCouple(user.uid, coupleId, user)
  }, [restoreForCouple])

  const ensureUserDoc = useCallback(async (user: User) => {
    try {
      await createOrGetUserDoc(
        user.uid,
        user.displayName,
        user.isAnonymous ? '나' : undefined,
        user.email,
      )
    } catch (err) {
      console.warn('[Session] createOrGetUserDoc failed', err)
    }
  }, [])

  const handleAuthUser = useCallback(async (user: User | null) => {
    if (!user) {
      restoreGenerationRef.current += 1
      currentUserRef.current = null
      profileCoupleIdRef.current = null
      setSession({
        status: 'signed_out',
        user: null,
        uid: null,
        coupleId: null,
        connection: null,
        error: null,
      })
      return
    }

    currentUserRef.current = user
    setSession((prev) => ({
      ...prev,
      status: 'loading',
      user,
      uid: user.uid,
      error: null,
    }))

    await ensureUserDoc(user)
  }, [ensureUserDoc])

  const retryRestore = useCallback(async () => {
    const user = currentUserRef.current
    const coupleId = profileCoupleIdRef.current
    if (!user || !coupleId) return
    await restoreForCouple(user.uid, coupleId, user)
  }, [restoreForCouple])

  const refreshSession = useCallback(async () => {
    const user = currentUserRef.current
    const coupleId = profileCoupleIdRef.current
    if (!user) return
    if (!coupleId) {
      setSession((prev) => ({
        ...prev,
        status: 'no_couple',
        user,
        uid: user.uid,
        coupleId: null,
        connection: null,
        error: null,
      }))
      return
    }

    if (sessionStatusRef.current === 'connected') {
      try {
        const restored = await restoreConnectionFromProfile(user.uid)
        if (restored) {
          setSession((prev) => ({
            ...prev,
            status: 'connected',
            user,
            uid: user.uid,
            coupleId: restored.coupleId,
            connection: restored,
            error: null,
          }))
        }
      } catch (err) {
        console.warn('[Session] lightweight refresh failed', err)
      }
      return
    }

    await restoreForCouple(user.uid, coupleId, user)
  }, [restoreForCouple])

  useEffect(() => {
    const user = session.user
    if (!user) return

    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const data = snap.data()
        if (data?.approved === false && !isAdminEmail(user.email)) {
          restoreGenerationRef.current += 1
          currentUserRef.current = user
          profileCoupleIdRef.current = null
          setSession({
            status: 'approval_pending',
            user,
            uid: user.uid,
            coupleId: null,
            connection: null,
            error: null,
          })
          return
        }
        const cid = snap.data()?.coupleId
        const nextCoupleId = typeof cid === 'string' && cid.length > 0 ? cid : null
        applyProfileCoupleId(user, nextCoupleId)
      },
      (err) => {
        console.warn('[Session] users snapshot error', err)
        if (profileCoupleIdRef.current) {
          setSession((prev) => ({
            ...prev,
            status: 'restore_failed',
            error: '프로필을 불러오지 못했어요.',
          }))
        }
      },
    )

    return () => unsub()
  }, [session.user?.uid, applyProfileCoupleId])

  useEffect(() => {
    if (!session.user) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshSession()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [session.user, refreshSession])

  useEffect(() => {
    cancelledRef.current = false
    let unsubAuth: (() => void) | undefined

    const init = async () => {
      try {
        const redirectResult = await getRedirectResult(auth)
        if (cancelledRef.current) return

        if (redirectResult?.user) {
          markRedirecting(false)
          await handleAuthUser(redirectResult.user)
          redirectHandledRef.current = true
          authBootstrappedRef.current = true
        }
      } catch (error) {
        const code = (error as AuthError)?.code ?? ''
        if (code === 'auth/credential-already-in-use') {
          const credential = GoogleAuthProvider.credentialFromError(error as AuthError)
          if (credential) {
            try {
              const result = await signInWithCredential(auth, credential)
              markRedirecting(false)
              await handleAuthUser(result.user)
              redirectHandledRef.current = true
              authBootstrappedRef.current = true
            } catch (innerError) {
              console.warn('[Session] signInWithCredential fallback failed', innerError)
            }
          }
        } else {
          console.warn('[Session] getRedirectResult failed', error)
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

      unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
        if (cancelledRef.current) return

        if (redirectHandledRef.current) {
          redirectHandledRef.current = false
          return
        }

        let redirectPending = false
        try { redirectPending = sessionStorage.getItem(REDIRECTING_KEY) === '1' } catch { /* ignore */ }

        if (!nextUser && redirectPending && !redirectCheckDoneRef.current) return
        if (!nextUser && redirectPending && redirectCheckDoneRef.current) markRedirecting(false)
        if (nextUser) markRedirecting(false)

        await handleAuthUser(nextUser)
        authBootstrappedRef.current = true
      })
    }

    void init()
    return () => {
      cancelledRef.current = true
      unsubAuth?.()
    }
  }, [handleAuthUser, markRedirecting])

  const signInWithExistingGoogleCredential = async (error: unknown) => {
    const credential = GoogleAuthProvider.credentialFromError(error as AuthError)
    if (!credential) return null
    const result = await signInWithCredential(auth, credential)
    markRedirecting(false)
    await handleAuthUser(result.user)
    return result.user
  }

  const signInWithGoogle = async () => {
    try {
      if (auth.currentUser) await firebaseSignOut(auth)
      const user = await signInWithGoogleViaGsi()
      await handleAuthUser(user)
      markRedirecting(false)
      return user
    } catch (error) {
      markRedirecting(false)
      setAuthError(toAuthErrorMessage(error))
      throw error
    }
  }

  const signInAnon = async () => {
    const result = await signInAnonymously(auth)
    await handleAuthUser(result.user)
    return result.user
  }

  const linkGoogle = async () => {
    if (!auth.currentUser) throw new Error('로그인 정보가 없습니다.')
    try {
      const linked = await linkGoogleViaGsi(auth.currentUser)
      await handleAuthUser(linked)
      markRedirecting(false)
    } catch (error) {
      const code = (error as AuthError)?.code ?? ''
      if (code === 'auth/provider-already-linked') return
      if (code === 'auth/credential-already-in-use') {
        const existing = await signInWithExistingGoogleCredential(error)
        if (existing) return
        await firebaseSignOut(auth)
        const user = await signInWithGoogleViaGsi()
        await handleAuthUser(user)
        markRedirecting(false)
        return
      }
      markRedirecting(false)
      throw error
    }
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  const notifyCoupleLinked = async () => {
    const user = currentUserRef.current
    if (!user) return false
    try {
      const restored = await restoreConnectionFromProfile(user.uid)
      if (!restored) return false
      profileCoupleIdRef.current = restored.coupleId
      setSession({
        status: 'connected',
        user,
        uid: user.uid,
        coupleId: restored.coupleId,
        connection: restored,
        error: null,
      })
      return true
    } catch {
      return false
    }
  }

  const isGoogleLinked =
    session.user?.providerData.some((p) => p.providerId === 'google.com') ?? false

  const isLoading = session.status === 'loading' || session.status === 'restoring'

  return (
    <SessionContext.Provider
      value={{
        ...session,
        redirecting,
        authError,
        isLoading,
        isGoogleLinked,
        retryRestore,
        refreshSession,
        signInWithGoogle,
        signInAnon,
        linkGoogle,
        signOut,
        notifyCoupleLinked,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
