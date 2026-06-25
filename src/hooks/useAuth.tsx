// src/hooks/useAuth.tsx
// 하위 호환 — SessionContext thin wrapper
import { ReactNode } from 'react'
import { useSession } from '../context/SessionContext'
import type { RestoredConnection } from '../lib/coupleAuth'
import type { User } from 'firebase/auth'

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
  isGoogleLinked: boolean
  clearAuthError: () => void
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useAuth(): AuthContextValue {
  const session = useSession()

  const coupleId: string | null | undefined =
    session.status === 'loading' || session.status === 'restoring'
      ? undefined
      : session.status === 'connected'
        ? session.connection?.coupleId ?? session.coupleId
        : session.status === 'restore_failed'
          ? session.coupleId
          : null

  return {
    user: session.user,
    coupleId,
    connection: session.connection,
    loading: session.status === 'loading',
    isLoading: session.isLoading,
    redirecting: session.redirecting,
    authError: session.authError,
    setCoupleId: async () => {
      await session.notifyCoupleLinked()
    },
    linkGoogle: session.linkGoogle,
    signInWithGoogle: session.signInWithGoogle,
    isGoogleLinked: session.isGoogleLinked,
    clearAuthError: session.clearAuthError,
  }
}
