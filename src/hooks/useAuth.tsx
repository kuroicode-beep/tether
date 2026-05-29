import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import {
  getRedirectResult,
  linkWithPopup,
  linkWithRedirect,
  onAuthStateChanged,
  signInAnonymously,
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
  setCoupleId: (nextCoupleId: string | null) => Promise<void>
  linkGoogle: () => Promise<void>
  signInWithGoogle: () => Promise<User | null>
  signInAnon: () => Promise<User>
  isGoogleLinked: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [coupleId, setCoupleIdState] = useState<string | null | undefined>(undefined)
  const [connection, setConnection] = useState<RestoredConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)

  const syncProfile = async (nextUser: User | null) => {
    if (!nextUser) {
      setUser(null)
      setCoupleIdState(null)
      setConnection(null)
      return null
    }

    await createOrGetUserDoc(
      nextUser.uid,
      nextUser.displayName,
      nextUser.isAnonymous ? '나' : undefined,
    )

    const nextCoupleId = await getMyCoupleId(nextUser.uid)
    if (!nextCoupleId) {
      setUser(nextUser)
      setCoupleIdState(null)
      setConnection(null)
      return null
    }

    const restored = await restoreConnectionFromProfile(nextUser.uid)
    if (!restored) {
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
    let cancelled = false
    let unsub: (() => void) | undefined

    const finish = () => {
      if (!cancelled) setLoading(false)
    }

    const init = async () => {
      try {
        const redirectResult = await getRedirectResult(auth)
        if (cancelled) return

        if (redirectResult?.user) {
          await syncProfile(redirectResult.user)
          finish()
          return
        }
      } catch {
        // No usable redirect result. Continue with the persistent auth state.
      }

      if (cancelled) return
      unsub = onAuthStateChanged(auth, async (nextUser) => {
        if (cancelled) return
        setCoupleIdState(undefined)
        await syncProfile(nextUser)
        finish()
      })
    }

    init()

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  const setCoupleId = async (nextCoupleId: string | null) => {
    setCoupleIdState(nextCoupleId)
    if (!auth.currentUser || !nextCoupleId) {
      setConnection(null)
      return
    }

    const restored = await restoreConnectionFromProfile(auth.currentUser.uid)
    setConnection(restored)
  }

  const linkGoogle = async () => {
    if (!auth.currentUser) throw new Error('로그인 정보가 없습니다.')

    try {
      if (isMobile()) {
        setRedirecting(true)
        await linkWithRedirect(auth.currentUser, googleProvider)
        return
      }

      const result = await linkWithPopup(auth.currentUser, googleProvider)
      await syncProfile(result.user)
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === 'auth/provider-already-linked') return
      if (code === 'auth/credential-already-in-use') {
        if (isMobile()) {
          setRedirecting(true)
          await signInWithRedirect(auth, googleProvider)
        } else {
          const result = await signInWithPopup(auth, googleProvider)
          await syncProfile(result.user)
        }
        return
      }
      throw error
    } finally {
      if (!isMobile()) setRedirecting(false)
    }
  }

  const signInWithGoogle = async () => {
    if (isMobile()) {
      setRedirecting(true)
      await signInWithRedirect(auth, googleProvider)
      return null
    }

    const result = await signInWithPopup(auth, googleProvider)
    await syncProfile(result.user)
    return result.user
  }

  const signInAnon = async () => {
    const result = await signInAnonymously(auth)
    await syncProfile(result.user)
    return result.user
  }

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
        setCoupleId,
        linkGoogle,
        signInWithGoogle,
        signInAnon,
        isGoogleLinked,
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
