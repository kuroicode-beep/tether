// src/hooks/useRecentFeed.ts
// 파트너 최근 활동(24시간) 실시간 피드 구독
import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

export type FeedCategory = 'message' | 'diary' | 'contents' | 'photo' | 'status'

export interface FeedItem {
  id: string
  category: FeedCategory
  authorUid: string
  createdAt: number
  screen: string
}

const FEED_WINDOW_MS = 24 * 60 * 60 * 1000
const FEED_LIMIT = 3

const toMillis = (value: unknown): number | null => {
  if (value instanceof Timestamp) return value.toMillis()
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis()
  }
  return null
}

export function useRecentFeed(
  coupleId: string | null,
  myUid: string | null,
  partnerUid: string | null,
) {
  const [items, setItems] = useState<FeedItem[]>([])

  useEffect(() => {
    if (!coupleId || !myUid || !partnerUid) {
      setItems([])
      return
    }

    const since = Date.now() - FEED_WINDOW_MS
    const buckets: Record<FeedCategory, FeedItem[]> = {
      message: [],
      diary: [],
      contents: [],
      photo: [],
      status: [],
    }

    const merge = () => {
      const memberUids = new Set([myUid, partnerUid])
      const merged = Object.values(buckets)
        .flat()
        .filter((item) => memberUids.has(item.authorUid) && item.createdAt >= since)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, FEED_LIMIT)
      setItems(merged)
    }

    const unsubs = [
      onSnapshot(
        query(collection(db, 'couples', coupleId, 'messages'), orderBy('createdAt', 'desc'), limit(5)),
        (snap) => {
          buckets.message = snap.docs
            .map((d) => {
              const createdAt = toMillis(d.data().createdAt)
              if (!createdAt) return null
              return {
                id: `msg_${d.id}`,
                category: 'message' as const,
                authorUid: d.data().senderUid as string,
                createdAt,
                screen: 'chat',
              }
            })
            .filter(Boolean) as FeedItem[]
          merge()
        },
      ),
      onSnapshot(
        query(collection(db, 'couples', coupleId, 'diary'), orderBy('createdAt', 'desc'), limit(5)),
        (snap) => {
          buckets.diary = snap.docs
            .map((d) => {
              const createdAt = toMillis(d.data().createdAt)
              if (!createdAt) return null
              return {
                id: `diary_${d.id}`,
                category: 'diary' as const,
                authorUid: d.data().authorUid as string,
                createdAt,
                screen: 'diary',
              }
            })
            .filter(Boolean) as FeedItem[]
          merge()
        },
      ),
      onSnapshot(
        query(collection(db, 'couples', coupleId, 'contents'), orderBy('createdAt', 'desc'), limit(5)),
        (snap) => {
          buckets.contents = snap.docs
            .map((d) => {
              const createdAt = toMillis(d.data().createdAt)
              if (!createdAt) return null
              return {
                id: `contents_${d.id}`,
                category: 'contents' as const,
                authorUid: d.data().addedBy as string,
                createdAt,
                screen: 'contents',
              }
            })
            .filter(Boolean) as FeedItem[]
          merge()
        },
      ),
      onSnapshot(
        query(collection(db, 'couples', coupleId, 'photos'), orderBy('createdAt', 'desc'), limit(5)),
        (snap) => {
          buckets.photo = snap.docs
            .map((d) => {
              const createdAt = toMillis(d.data().createdAt)
              if (!createdAt) return null
              return {
                id: `photo_${d.id}`,
                category: 'photo' as const,
                authorUid: d.data().uploadedBy as string,
                createdAt,
                screen: 'photo',
              }
            })
            .filter(Boolean) as FeedItem[]
          merge()
        },
      ),
      onSnapshot(doc(db, 'couples', coupleId, 'status', myUid), (snap) => {
        const partnerStatus = buckets.status.filter((item) => item.authorUid === partnerUid)
        if (!snap.exists()) {
          buckets.status = partnerStatus
          merge()
          return
        }
        const createdAt = toMillis(snap.data().updatedAt) ?? Date.now()
        buckets.status = [
          ...partnerStatus,
          {
            id: `status_${myUid}`,
            category: 'status',
            authorUid: myUid,
            createdAt,
            screen: 'home',
          },
        ]
        merge()
      }),
      onSnapshot(doc(db, 'couples', coupleId, 'status', partnerUid), (snap) => {
        const myStatus = buckets.status.filter((item) => item.authorUid === myUid)
        if (!snap.exists()) {
          buckets.status = myStatus
          merge()
          return
        }
        const createdAt = toMillis(snap.data().updatedAt) ?? Date.now()
        buckets.status = [
          ...myStatus,
          {
            id: `status_${partnerUid}`,
            category: 'status',
            authorUid: partnerUid,
            createdAt,
            screen: 'home',
          },
        ]
        merge()
      }),
    ]

    return () => unsubs.forEach((unsub) => unsub())
  }, [coupleId, myUid, partnerUid])

  return items
}
