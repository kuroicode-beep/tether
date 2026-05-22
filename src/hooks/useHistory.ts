import { useState, useEffect } from 'react'
import {
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'

// date 필드용 Timestamp 변환
function toFirestoreDate(date: Date) {
  return Timestamp.fromDate(date)
}
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'

export interface HistoryItem {
  id: string
  title: string
  memo: string | null
  date: number        // 있었던 날짜 (ms epoch)
  imageUrl: string | null
  createdAt: number | null
}

const LS_KEY = (coupleId: string) => `tether_history_${coupleId}`

function toItem(data: Record<string, unknown>, id: string): HistoryItem {
  const dateTs = data['date'] as Timestamp | null
  const createdTs = data['createdAt'] as Timestamp | null
  return {
    id,
    title: (data['title'] as string) ?? '',
    memo: (data['memo'] as string | null) ?? null,
    date: dateTs?.toMillis() ?? Date.now(),
    imageUrl: (data['imageUrl'] as string | null) ?? null,
    createdAt: createdTs?.toMillis() ?? null,
  }
}

export function useHistory(coupleId: string | null) {
  const [items, setItems] = useState<HistoryItem[]>(() => {
    if (!coupleId) return []
    try { return JSON.parse(localStorage.getItem(LS_KEY(coupleId)) ?? '[]') } catch { return [] }
  })

  useEffect(() => {
    if (!coupleId) return
    let unsub: (() => void) | undefined
    try {
      const q = query(
        collection(db, 'couples', coupleId, 'history'),
        orderBy('date', 'desc'),
      )
      unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => toItem(d.data() as Record<string, unknown>, d.id))
        setItems(list)
        localStorage.setItem(LS_KEY(coupleId), JSON.stringify(list))
      }, () => { /* Firebase 미설정 */ })
    } catch { /* ignore */ }
    return () => unsub?.()
  }, [coupleId])

  const addHistory = async (data: {
    title: string
    memo?: string
    date: Date
    imageFile?: File
  }) => {
    if (!coupleId) return
    let imageUrl: string | null = null
    if (data.imageFile) {
      try {
        const path = `couples/${coupleId}/history/${Date.now()}_${data.imageFile.name}`
        await uploadBytes(ref(storage, path), data.imageFile)
        imageUrl = await getDownloadURL(ref(storage, path))
      } catch { imageUrl = null }
    }

    const optimistic: HistoryItem = {
      id: `opt_${Date.now()}`,
      title: data.title,
      memo: data.memo ?? null,
      date: data.date.getTime(),
      imageUrl,
      createdAt: Date.now(),
    }
    setItems((prev) => [optimistic, ...prev].sort((a, b) => b.date - a.date))

    try {
      await addDoc(collection(db, 'couples', coupleId, 'history'), {
        title: data.title,
        memo: data.memo ?? null,
        date: toFirestoreDate(data.date),
        imageUrl,
        createdAt: serverTimestamp(),
      })
    } catch { /* Firebase 미설정 */ }
  }

  return { items, addHistory }
}
