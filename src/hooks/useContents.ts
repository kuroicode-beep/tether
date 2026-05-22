import { useState, useEffect } from 'react'
import {
  collection, addDoc, onSnapshot, doc,
  updateDoc, query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

export type ContentCategory = 'book' | 'movie' | 'drama' | 'youtube' | 'etc'
export type ContentStatus = 'want' | 'watching' | 'done'

export interface ContentItem {
  id: string
  addedBy: string
  category: ContentCategory
  title: string
  memo: string | null
  status: ContentStatus
  rating: number | null
  review: string | null
  createdAt: number | null
}

const LS_KEY = (coupleId: string) => `tether_contents_${coupleId}`

function toItem(data: Record<string, unknown>, id: string): ContentItem {
  const ts = data['createdAt'] as Timestamp | null
  return {
    id,
    addedBy: (data['addedBy'] as string) ?? '',
    category: (data['category'] as ContentCategory) ?? 'etc',
    title: (data['title'] as string) ?? '',
    memo: (data['memo'] as string | null) ?? null,
    status: (data['status'] as ContentStatus) ?? 'want',
    rating: (data['rating'] as number | null) ?? null,
    review: (data['review'] as string | null) ?? null,
    createdAt: ts?.toMillis() ?? null,
  }
}

export function useContents(coupleId: string | null, myUid: string | null) {
  const [items, setItems] = useState<ContentItem[]>(() => {
    if (!coupleId) return []
    try { return JSON.parse(localStorage.getItem(LS_KEY(coupleId)) ?? '[]') } catch { return [] }
  })

  useEffect(() => {
    if (!coupleId) return
    let unsub: (() => void) | undefined
    try {
      const q = query(
        collection(db, 'couples', coupleId, 'contents'),
        orderBy('createdAt', 'desc'),
      )
      unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => toItem(d.data() as Record<string, unknown>, d.id))
        setItems(list)
        localStorage.setItem(LS_KEY(coupleId), JSON.stringify(list))
      }, () => { /* Firebase 미설정 */ })
    } catch { /* ignore */ }
    return () => unsub?.()
  }, [coupleId])

  const addContent = async (data: { category: ContentCategory; title: string; memo?: string }) => {
    if (!coupleId || !myUid) return
    const optimistic: ContentItem = {
      id: `opt_${Date.now()}`,
      addedBy: myUid,
      category: data.category,
      title: data.title,
      memo: data.memo ?? null,
      status: 'want',
      rating: null,
      review: null,
      createdAt: Date.now(),
    }
    setItems((prev) => [optimistic, ...prev])
    try {
      await addDoc(collection(db, 'couples', coupleId, 'contents'), {
        addedBy: myUid,
        category: data.category,
        title: data.title,
        memo: data.memo ?? null,
        status: 'want',
        rating: null,
        review: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch { /* Firebase 미설정 */ }
  }

  const updateStatus = async (
    contentId: string,
    status: ContentStatus,
    extra?: { rating?: number; review?: string },
  ) => {
    if (!coupleId || contentId.startsWith('opt_')) {
      setItems((prev) => prev.map((i) => i.id === contentId ? { ...i, status, ...extra } : i))
      return
    }
    setItems((prev) => prev.map((i) => i.id === contentId ? { ...i, status, ...extra } : i))
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'contents', contentId), {
        status, ...extra, updatedAt: serverTimestamp(),
      })
    } catch { /* ignore */ }
  }

  return { items, addContent, updateStatus }
}
