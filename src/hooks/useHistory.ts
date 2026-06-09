import { useState, useEffect, useRef, useCallback } from 'react'
import {
  collection, addDoc, onSnapshot, doc, getDoc,
  updateDoc, deleteDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { createClientId, createOptimisticId } from '../lib/clientId'
import { isOptimisticId, mergeByDateDesc, readClientId, reconcilePending } from '../lib/syncHelpers'

function toFirestoreDate(date: Date) {
  return Timestamp.fromDate(date)
}

export interface HistoryItem {
  id: string
  clientId?: string
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
    clientId: readClientId(data),
    authorUid: (data['authorUid'] as string | null) ?? null,
    title: (data['title'] as string) ?? '',
    memo: (data['memo'] as string | null) ?? null,
    date: dateTs?.toMillis() ?? Date.now(),
    imageUrl: (data['imageUrl'] as string | null) ?? null,
    createdAt: createdTs?.toMillis() ?? null,
  }
}

function sortHistory(items: HistoryItem[]): HistoryItem[] {
  return [...items].sort((a, b) => b.date - a.date)
}

export function useHistory(coupleId: string | null, myUid: string | null, partnerUid?: string | null) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef(new Map<string, HistoryItem>())

  const applyServerDocs = useCallback((server: HistoryItem[]) => {
    reconcilePending(pendingRef.current, server, (p, s) =>
      p.authorUid === s.authorUid
      && p.title === s.title
      && Math.abs(p.date - s.date) < 86_400_000,
    (s) => s.clientId)
    setItems(mergeByDateDesc(server, [...pendingRef.current.values()]))
  }, [])

  useEffect(() => {
    if (!coupleId || !myUid) {
      pendingRef.current.clear()
      setItems([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const verifyAndSubscribe = async () => {
      try {
        const coupleSnap = await getDoc(doc(db, 'couples', coupleId))
        if (cancelled) return
        const members = coupleSnap.data()?.members
        if (!coupleSnap.exists() || !Array.isArray(members) || !members.includes(myUid)) {
          setError('커플 연결 정보를 확인할 수 없어요.')
          setItems([])
          setLoading(false)
          return
        }

        if (partnerUid) {
          const partnerSnap = await getDoc(doc(db, 'users', partnerUid))
          if (cancelled) return
          const partnerCoupleId = partnerSnap.data()?.coupleId
          if (partnerCoupleId && partnerCoupleId !== coupleId) {
            setError('상대방과 연결 정보가 일치하지 않아요.')
          }
        }
      } catch (err) {
        console.warn('[useHistory] membership check failed', err)
      }

      if (cancelled) return

      return onSnapshot(
        collection(db, 'couples', coupleId, 'history'),
        (snap) => {
          const server = sortHistory(
            snap.docs.map((d) => toItem(d.data() as Record<string, unknown>, d.id)),
          )
          applyServerDocs(server)
          setLoading(false)
          setError((prev) => (prev?.includes('연결') ? prev : null))
        },
        (err) => {
          console.warn('[useHistory] listener error', err)
          setLoading(false)
          setError('기록을 불러오지 못했어요.')
        },
      )
    }

    let unsub: (() => void) | undefined
    void verifyAndSubscribe().then((fn) => { unsub = fn })

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [coupleId, myUid, partnerUid, applyServerDocs])

  const addHistory = async (data: {
    title: string
    memo?: string
    date: Date
    imageFile?: File
  }) => {
    if (!coupleId || !myUid) return
    setError(null)

    let imageUrl: string | null = null
    if (data.imageFile) {
      try {
        const safeName = data.imageFile.name.replace(/[^\w.\-]/g, '_')
        const path = `couples/${coupleId}/history/${Date.now()}_${safeName}`
        await uploadBytes(ref(storage, path), data.imageFile, {
          contentType: data.imageFile.type || 'image/jpeg',
        })
        imageUrl = await getDownloadURL(ref(storage, path))
      } catch (err) {
        console.warn('[useHistory] image upload failed', err)
        setError('사진 업로드에 실패했어요.')
        return
      }
    }

    const clientId = createClientId('history')
    const optimistic: HistoryItem = {
      id: createOptimisticId(clientId),
      clientId,
      authorUid: myUid,
      title: data.title,
      memo: data.memo ?? null,
      date: data.date.getTime(),
      imageUrl,
      createdAt: Date.now(),
    }
    pendingRef.current.set(optimistic.id, optimistic)
    setItems((prev) => mergeByDateDesc(prev.filter((i) => i.id !== optimistic.id), [optimistic]))

    try {
      const now = Timestamp.now()
      await addDoc(collection(db, 'couples', coupleId, 'history'), {
        clientId,
        authorUid: myUid,
        title: data.title,
        memo: data.memo ?? null,
        date: toFirestoreDate(data.date),
        imageUrl,
        createdAt: now,
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn('[useHistory] addHistory failed', err)
      pendingRef.current.delete(optimistic.id)
      setItems((prev) => prev.filter((i) => i.id !== optimistic.id))
      setError('기록 저장에 실패했어요.')
    }
  }

  const updateHistory = async (
    itemId: string,
    data: { title: string; memo?: string | null; date: Date; imageFile?: File },
  ) => {
    if (!coupleId || isOptimisticId(itemId)) return
    let imageUrl: string | undefined
    if (data.imageFile) {
      try {
        const safeName = data.imageFile.name.replace(/[^\w.\-]/g, '_')
        const path = `couples/${coupleId}/history/${Date.now()}_${safeName}`
        await uploadBytes(ref(storage, path), data.imageFile, {
          contentType: data.imageFile.type || 'image/jpeg',
        })
        imageUrl = await getDownloadURL(ref(storage, path))
      } catch (err) {
        console.warn('[useHistory] image upload failed', err)
        setError('사진 업로드에 실패했어요.')
        return
      }
    }
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'history', itemId), {
        title: data.title,
        memo: data.memo ?? null,
        date: toFirestoreDate(data.date),
        ...(imageUrl ? { imageUrl } : {}),
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn('[useHistory] updateHistory failed', err)
      setError('기록 수정에 실패했어요.')
    }
  }

  const deleteHistory = async (itemId: string) => {
    if (!coupleId || isOptimisticId(itemId)) return
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'history', itemId))
    } catch (err) {
      console.warn('[useHistory] deleteHistory failed', err)
      setError('기록 삭제에 실패했어요.')
    }
  }

  return { items, loading, error, addHistory, updateHistory, deleteHistory, clearError: () => setError(null) }
}
