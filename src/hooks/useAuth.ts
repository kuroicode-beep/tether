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

export function useAuth() {
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }

    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) setUser(result.user)
      })
      .catch(() => {
        // Redirect errors are surfaced again through explicit button actions.
      })

    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const linkGoogle = async () => {
    if (!auth?.currentUser) throw new Error('로그인 정보가 없어요.')

    try {
      if (isMobile()) {
        await linkWithRedirect(auth.currentUser, googleProvider)
      } else {
        await linkWithPopup(auth.currentUser, googleProvider)
      }
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === 'auth/provider-already-linked') return
      if (code === 'auth/credential-already-in-use') {
        if (isMobile()) {
          await signInWithRedirect(auth, googleProvider)
        } else {
          await signInWithPopup(auth, googleProvider)
        }
        return
      }
      throw error
    }
  }

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Firebase 인증이 설정되지 않았어요.')
    if (isMobile()) {
      await signInWithRedirect(auth, googleProvider)
      return null
    } else {
      const result = await signInWithPopup(auth, googleProvider)
      return result.user
    }
  }

  const signInAnon = async () => {
    if (!auth) return null
    const result = await signInAnonymously(auth)
    return result.user
  }

  const isGoogleLinked =
    user?.providerData.some((provider) => provider.providerId === 'google.com') ?? false

  return {
    user,
    loading,
    linkGoogle,
    signInWithGoogle,
    signInAnon,
    isGoogleLinked,
  }
}
