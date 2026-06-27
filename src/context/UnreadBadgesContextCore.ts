import { createContext } from 'react'

export type NavTab = 'chat' | 'diary' | 'contents'
export type UnreadBadges = Record<NavTab, number>

export type UnreadBadgesContextValue = {
  badges: UnreadBadges
  markTabRead: (tab: NavTab) => Promise<void>
}

export const UnreadBadgesContext = createContext<UnreadBadgesContextValue | null>(null)
