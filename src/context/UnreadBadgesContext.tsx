// src/context/UnreadBadgesContext.tsx
// 하단 네비 미읽음 배지 — chat: readBy, diary: isRead, contents: lastRead.contents
import { ReactNode, useCallback, useEffect, useState } from 'react'
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
import {
  UnreadBadgesContext,
  type NavTab,
  type UnreadBadges,
} from './UnreadBadgesContextCore'

const EMPTY_BADGES: UnreadBadges = { chat: 0, diary: 0, contents: 0 }

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
  const [contentsReadSince, setContentsReadSince] = useState(0)

  useEffect(() => {
    if (!uid) {
      setContentsReadSince(0)
      return
    }

    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      const raw = snap.data()?.lastRead as Record<string, unknown> | undefined
      if (!raw) {
        setContentsReadSince(0)
        return
      }
      const contents = toMillis(raw.contents)
      const legacyMore = toMillis(raw.more)
      setContentsReadSince(contents || legacyMore)
    })

    return () => unsub()
  }, [uid])

  useEffect(() => {
    if (!coupleId || !uid) {
      setBadges(EMPTY_BADGES)
      return
    }

    const counts: UnreadBadges = { ...EMPTY_BADGES }

    const merge = () => setBadges({ ...counts })

    const unsubs = [
      onSnapshot(
        query(collection(db, 'couples', coupleId, 'messages'), orderBy('createdAt', 'desc')),
        (snap) => {
          counts.chat = snap.docs.filter((d) => {
            const data = d.data()
            return data.senderUid !== uid && !(data.readBy ?? []).includes(uid)
          }).length
          merge()
        },
      ),
      onSnapshot(query(collection(db, 'couples', coupleId, 'diary'), orderBy('createdAt', 'desc')), (snap) => {
        counts.diary = snap.docs.filter((d) => {
          const data = d.data()
          return data.authorUid !== uid && data.isRead !== true
        }).length
        merge()
      }),
      onSnapshot(
        query(collection(db, 'couples', coupleId, 'contents'), orderBy('createdAt', 'desc')),
        (snap) => {
          counts.contents = snap.docs.filter((d) => {
            const data = d.data()
            const addedBy = data.addedBy as string
            const createdAt = toMillis(data.createdAt)
            return addedBy !== uid && createdAt > contentsReadSince
          }).length
          merge()
        },
      ),
    ]

    return () => unsubs.forEach((unsub) => unsub())
  }, [coupleId, uid, contentsReadSince])

  const markTabRead = useCallback(
    async (tab: NavTab) => {
      if (!uid || tab !== 'contents') return
      const now = Date.now()
      setContentsReadSince(now)
      try {
        await updateDoc(doc(db, 'users', uid), {
          'lastRead.contents': serverTimestamp(),
        })
        debugLog('UnreadBadgesContext.tsx:markTabRead', 'ok', { tab }, 'H2')
      } catch (error) {
        const code = (error as { code?: string })?.code ?? 'unknown'
        debugLog('UnreadBadgesContext.tsx:markTabRead', 'fail', { tab, code }, 'H2')
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
