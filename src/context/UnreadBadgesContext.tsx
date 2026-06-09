// src/context/UnreadBadgesContext.tsx
// 하단 네비 미읽음 배지 — 전역 단일 상태 + 탭 진입 시 즉시 반영
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { debugLog } from '../lib/debugLog'

export type NavTab = 'chat' | 'diary' | 'more'
export type UnreadBadges = Record<NavTab, number>

const EMPTY_BADGES: UnreadBadges = { chat: 0, diary: 0, more: 0 }

type LastReadMap = Partial<Record<NavTab, number>>

type UnreadBadgesContextValue = {
  badges: UnreadBadges
  markTabRead: (tab: NavTab) => Promise<void>
}

const UnreadBadgesContext = createContext<UnreadBadgesContextValue | null>(null)

const toMillis = (value: unknown): number => {
  if (value instanceof Timestamp) return value.toMillis()
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis()
  }
  if (typeof value === 'number') return value
  return 0
}

export function UnreadBadgesProvider({
  coupleId,
  uid,
  children,
}: {
  coupleId: string | null
  uid: string | null
  children: ReactNode
}) {
  const [badges, setBadges] = useState<UnreadBadges>(EMPTY_BADGES)
  const [lastRead, setLastRead] = useState<LastReadMap>({})

  useEffect(() => {
    if (!uid) {
      setLastRead({})
      return
    }

    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      const raw = snap.data()?.lastRead as Record<string, unknown> | undefined
      if (!raw) {
        setLastRead({})
        return
      }
      setLastRead({
        chat: toMillis(raw.chat),
        diary: toMillis(raw.diary),
        more: toMillis(raw.more),
      })
    })

    return () => unsub()
  }, [uid])

  useEffect(() => {
    if (!coupleId || !uid) {
      setBadges(EMPTY_BADGES)
      return
    }

    const chatSince = lastRead.chat ?? 0
    const moreSince = lastRead.more ?? 0
    const counts: UnreadBadges = { ...EMPTY_BADGES }

    const merge = () => setBadges({ ...counts })

    const unsubs = [
      onSnapshot(
        query(collection(db, 'couples', coupleId, 'messages'), orderBy('createdAt', 'desc')),
        (snap) => {
          counts.chat = snap.docs.filter((d) => {
            const senderUid = d.data().senderUid as string
            const createdAt = toMillis(d.data().createdAt)
            return senderUid !== uid && createdAt > chatSince
          }).length
          merge()
        },
      ),
      onSnapshot(query(collection(db, 'couples', coupleId, 'diary'), orderBy('createdAt', 'desc')), (snap) => {
        counts.diary = snap.docs.filter((d) => {
          const authorUid = d.data().authorUid as string
          const isRead = d.data().isRead as boolean
          return authorUid !== uid && !isRead
        }).length
        merge()
      }),
      onSnapshot(
        query(collection(db, 'couples', coupleId, 'contents'), orderBy('createdAt', 'desc')),
        (snap) => {
          counts.more = snap.docs.filter((d) => {
            const addedBy = d.data().addedBy as string
            const createdAt = toMillis(d.data().createdAt)
            return addedBy !== uid && createdAt > moreSince
          }).length
          merge()
        },
      ),
    ]

    return () => unsubs.forEach((unsub) => unsub())
  }, [coupleId, uid, lastRead.chat, lastRead.more])

  const markTabRead = useCallback(
    async (tab: NavTab) => {
      if (!uid) return
      const now = Date.now()
      setLastRead((prev) => ({ ...prev, [tab]: now }))
      try {
        await updateDoc(doc(db, 'users', uid), {
          [`lastRead.${tab}`]: serverTimestamp(),
        })
        // #region agent log
        debugLog('UnreadBadgesContext.tsx:markTabRead', 'ok', { tab }, 'H2')
        // #endregion
      } catch (error) {
        const code = (error as { code?: string })?.code ?? 'unknown'
        // #region agent log
        debugLog('UnreadBadgesContext.tsx:markTabRead', 'fail', { tab, code }, 'H2')
        // #endregion
        console.warn('[UnreadBadges] markTabRead failed', error)
      }
    },
    [uid],
  )

  return (
    <UnreadBadgesContext.Provider value={{ badges, markTabRead }}>
      {children}
    </UnreadBadgesContext.Provider>
  )
}

export function useUnreadBadges() {
  const ctx = useContext(UnreadBadgesContext)
  if (!ctx) throw new Error('useUnreadBadges must be used within UnreadBadgesProvider')
  return ctx
}
