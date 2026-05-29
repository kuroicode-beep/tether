import { useState, useEffect } from 'react'
import {
  collection, addDoc, onSnapshot, doc,
  updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp,
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
  const [items, setItems] = useState<ContentItem[]>([])

  useEffect(() => {
    if (!coupleId) {
      setItems([])
      return
    }

    const q = query(
      collection(db, 'couples', coupleId, 'contents'),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => toItem(d.data() as Record<string, unknown>, d.id)))
    })
    return () => unsub()
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
    } catch { /* ignore */ }
  }

  const updateStatus = async (
    contentId: string,
    status: ContentStatus,
    extra?: { rating?: number; review?: string },
  ) => {
    setItems((prev) => prev.map((i) => i.id === contentId ? { ...i, status, ...extra } : i))
    if (!coupleId || contentId.startsWith('opt_')) return

    try {
      await updateDoc(doc(db, 'couples', coupleId, 'contents', contentId), {
        status,
        ...extra,
        updatedAt: serverTimestamp(),
      })
    } catch { /* ignore */ }
  }

  const updateContent = async (
    contentId: string,
    data: { title: string; memo?: string | null },
  ) => {
    if (!coupleId || contentId.startsWith('opt_')) return
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'contents', contentId), {
        title: data.title,
        memo: data.memo ?? null,
        updatedAt: serverTimestamp(),
      })
    } catch { /* ignore */ }
  }

  const deleteContent = async (contentId: string) => {
    if (!coupleId || contentId.startsWith('opt_')) return
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'contents', contentId))
    } catch { /* ignore */ }
  }

  return { items, addContent, updateStatus, updateContent, deleteContent }
}
