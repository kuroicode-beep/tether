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
import { createOrGetUserDoc } from '../lib/coupleAuth'

export function useAuth() {
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const syncProfile = async (nextUser: User | null) => {
    if (!nextUser) {
      setCoupleId(null)
      return
    }

    const profile = await createOrGetUserDoc(
      nextUser.uid,
      nextUser.displayName,
      nextUser.isAnonymous ? '나' : undefined,
    )
    setCoupleId(profile.coupleId)
  }

  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result?.user) return
        setUser(result.user)
        await syncProfile(result.user)
      })
      .catch(() => {
        // Redirect errors are handled when the user retries the action.
      })

    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      syncProfile(nextUser).finally(() => setLoading(false))
    })
    return () => unsub()
  }, [])

  const linkGoogle = async () => {
    if (!auth.currentUser) throw new Error('로그인 정보가 없습니다.')

    try {
      const result = isMobile()
        ? await linkWithRedirect(auth.currentUser, googleProvider)
        : await linkWithPopup(auth.currentUser, googleProvider)
      if (result?.user) await syncProfile(result.user)
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === 'auth/provider-already-linked') return
      if (code === 'auth/credential-already-in-use') {
        if (isMobile()) {
          await signInWithRedirect(auth, googleProvider)
        } else {
          const result = await signInWithPopup(auth, googleProvider)
          await syncProfile(result.user)
        }
        return
      }
      throw error
    }
  }

  const signInWithGoogle = async () => {
    if (isMobile()) {
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

  return {
    user,
    coupleId,
    setCoupleId,
    loading,
    linkGoogle,
    signInWithGoogle,
    signInAnon,
    isGoogleLinked,
  }
}
