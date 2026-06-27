import { createContext } from 'react'
import type { User } from 'firebase/auth'
import type { RestoredConnection } from '../lib/coupleAuth'

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

export type SessionContextValue = SessionState & {
  redirecting: boolean
  authError: string | null
  isLoading: boolean
  isGoogleLinked: boolean
  retryRestore: () => Promise<void>
  refreshSession: () => Promise<void>
  signInWithGoogle: () => Promise<User | null>
  linkGoogle: () => Promise<void>
  signOut: () => Promise<void>
  notifyCoupleLinked: () => Promise<boolean>
  clearAuthError: () => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)
