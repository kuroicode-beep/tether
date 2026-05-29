import { useEffect, useState } from 'react'
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
import { createOrGetUserDoc, getMyCoupleId } from '../lib/coupleAuth'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)

  const syncProfile = async (nextUser: User | null) => {
    if (!nextUser) {
      setCoupleId(null)
      return null
    }

    await createOrGetUserDoc(
      nextUser.uid,
      nextUser.displayName,
      nextUser.isAnonymous ? '나' : undefined,
    )
    const nextCoupleId = await getMyCoupleId(nextUser.uid)
    setCoupleId(nextCoupleId)
    return nextCoupleId
  }

  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | undefined

    const init = async () => {
      try {
        const redirectResult = await getRedirectResult(auth)
        if (cancelled) return

        if (redirectResult?.user) {
          setUser(redirectResult.user)
          await syncProfile(redirectResult.user)
          if (!cancelled) setLoading(false)
          return
        }
      } catch {
        // No redirect result, or the redirect was cancelled. Continue with the
        // normal auth-state subscription so refreshes still restore correctly.
      }

      if (cancelled) return
      unsub = onAuthStateChanged(auth, async (nextUser) => {
        if (cancelled) return

        setUser(nextUser)
        await syncProfile(nextUser)
        if (!cancelled) setLoading(false)
      })
    }

    init()

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  const linkGoogle = async () => {
    if (!auth.currentUser) throw new Error('로그인 정보가 없습니다.')

    try {
      if (isMobile()) {
        setRedirecting(true)
        await linkWithRedirect(auth.currentUser, googleProvider)
        return
      }

      const result = await linkWithPopup(auth.currentUser, googleProvider)
      setUser(result.user)
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
          setUser(result.user)
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
    setUser(result.user)
    await syncProfile(result.user)
    return result.user
  }

  const signInAnon = async () => {
    const result = await signInAnonymously(auth)
    setUser(result.user)
    await syncProfile(result.user)
    return result.user
  }

  const isGoogleLinked =
    user?.providerData.some((provider) => provider.providerId === 'google.com') ?? false

  return {
    user,
    coupleId,
    setCoupleId,
    loading,
    redirecting,
    linkGoogle,
    signInWithGoogle,
    signInAnon,
    isGoogleLinked,
  }
}
