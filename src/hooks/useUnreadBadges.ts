// src/hooks/useUnreadBadges.ts
// 하단 네비게이션 미읽음 배지 계산 및 lastRead 갱신
import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

export type NavTab = 'chat' | 'diary' | 'more'

export type UnreadBadges = Record<NavTab, number>

const EMPTY_BADGES: UnreadBadges = { chat: 0, diary: 0, more: 0 }

type LastReadMap = Partial<Record<NavTab, number>>

const toMillis = (value: unknown): number => {
  if (value instanceof Timestamp) return value.toMillis()
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis()
  }
  if (typeof value === 'number') return value
  return 0
}

export function useUnreadBadges(coupleId: string | null, uid: string | null) {
  const [badges, setBadges] = useState<UnreadBadges>(EMPTY_BADGES)
  const [lastRead, setLastRead] = useState<LastReadMap>({})

  // users/{uid}.lastRead 구독
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

  // 커플 콘텐츠 변화에 따라 배지 수 계산
  useEffect(() => {
    if (!coupleId || !uid) {
      setBadges(EMPTY_BADGES)
      return
    }

    const chatSince = lastRead.chat ?? 0
    const diarySince = lastRead.diary ?? 0
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
      onSnapshot(
        query(collection(db, 'couples', coupleId, 'diary'), orderBy('createdAt', 'desc')),
        (snap) => {
          counts.diary = snap.docs.filter((d) => {
            const authorUid = d.data().authorUid as string
            const createdAt = toMillis(d.data().createdAt)
            const isRead = d.data().isRead as boolean
            return authorUid !== uid && createdAt > diarySince && !isRead
          }).length
          merge()
        },
      ),
      onSnapshot(
        query(collection(db, 'couples', coupleId, 'contents'), orderBy('createdAt', 'desc')),
        (snap) => {
          const unreadContents = snap.docs.filter((d) => {
            const addedBy = d.data().addedBy as string
            const createdAt = toMillis(d.data().createdAt)
            return addedBy !== uid && createdAt > moreSince
          }).length
          counts.more = unreadContents
          merge()
        },
      ),
    ]

    return () => unsubs.forEach((unsub) => unsub())
  }, [coupleId, uid, lastRead.chat, lastRead.diary, lastRead.more])

  // 탭 진입 시 lastReadAt을 갱신한다
  const markTabRead = async (tab: NavTab) => {
    if (!uid) return
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      const prev = (snap.data()?.lastRead as Record<string, unknown> | undefined) ?? {}
      await setDoc(
        doc(db, 'users', uid),
        {
          lastRead: {
            ...prev,
            [tab]: serverTimestamp(),
          },
        },
        { merge: true },
      )
    } catch (error) {
      console.warn('[useUnreadBadges] markTabRead failed', error)
    }
  }

  return { badges, markTabRead }
}
