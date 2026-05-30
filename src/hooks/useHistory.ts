import { useState, useEffect } from 'react'
import {
  collection, addDoc, onSnapshot, doc,
  updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'

function toFirestoreDate(date: Date) {
  return Timestamp.fromDate(date)
}

export interface HistoryItem {
  id: string
  authorUid: string | null
  title: string
  memo: string | null
  date: number
  imageUrl: string | null
  createdAt: number | null
}

function toItem(data: Record<string, unknown>, id: string): HistoryItem {
  const dateTs = data['date'] as Timestamp | null
  const createdTs = data['createdAt'] as Timestamp | null
  return {
    id,
    authorUid: (data['authorUid'] as string | null) ?? null,
    title: (data['title'] as string) ?? '',
    memo: (data['memo'] as string | null) ?? null,
    date: dateTs?.toMillis() ?? Date.now(),
    imageUrl: (data['imageUrl'] as string | null) ?? null,
    createdAt: createdTs?.toMillis() ?? null,
  }
}

export function useHistory(coupleId: string | null, myUid: string | null) {
  const [items, setItems] = useState<HistoryItem[]>([])

  useEffect(() => {
    if (!coupleId) {
      setItems([])
      return
    }

    const q = query(
      collection(db, 'couples', coupleId, 'history'),
      orderBy('date', 'desc'),
    )
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => toItem(d.data() as Record<string, unknown>, d.id)))
    })
    return () => unsub()
  }, [coupleId])

  const addHistory = async (data: {
    title: string
    memo?: string
    date: Date
    imageFile?: File
  }) => {
    if (!coupleId || !myUid) return
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
      authorUid: myUid,
      title: data.title,
      memo: data.memo ?? null,
      date: data.date.getTime(),
      imageUrl,
      createdAt: Date.now(),
    }
    setItems((prev) => [optimistic, ...prev].sort((a, b) => b.date - a.date))

    try {
      await addDoc(collection(db, 'couples', coupleId, 'history'), {
        authorUid: myUid,
        title: data.title,
        memo: data.memo ?? null,
        date: toFirestoreDate(data.date),
        imageUrl,
        createdAt: serverTimestamp(),
      })
    } catch { /* ignore */ }
  }

  const updateHistory = async (
    itemId: string,
    data: { title: string; memo?: string | null; date: Date; imageFile?: File },
  ) => {
    if (!coupleId || itemId.startsWith('opt_')) return
    let imageUrl: string | undefined
    if (data.imageFile) {
      try {
        const path = `couples/${coupleId}/history/${Date.now()}_${data.imageFile.name}`
        await uploadBytes(ref(storage, path), data.imageFile)
        imageUrl = await getDownloadURL(ref(storage, path))
      } catch { /* ignore upload failure */ }
    }
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'history', itemId), {
        title: data.title,
        memo: data.memo ?? null,
        date: toFirestoreDate(data.date),
        ...(imageUrl ? { imageUrl } : {}),
        updatedAt: serverTimestamp(),
      })
    } catch { /* ignore */ }
  }

  const deleteHistory = async (itemId: string) => {
    if (!coupleId || itemId.startsWith('opt_')) return
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'history', itemId))
    } catch { /* ignore */ }
  }

  return { items, addHistory, updateHistory, deleteHistory }
}
