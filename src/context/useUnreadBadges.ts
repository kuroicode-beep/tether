import { useContext } from 'react'
import { UnreadBadgesContext } from './UnreadBadgesContextCore'

export function useUnreadBadges() {
  const ctx = useContext(UnreadBadgesContext)
  if (!ctx) throw new Error('useUnreadBadges must be used within UnreadBadgesProvider')
  return ctx
}

export type { NavTab, UnreadBadges } from './UnreadBadgesContextCore'
