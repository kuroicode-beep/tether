import { useState, useEffect, useRef } from 'react'
import {
  collection, addDoc, onSnapshot, doc,
  updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { createClientId, createOptimisticId } from '../lib/clientId'
import { isOptimisticId, mergeByCreatedAtDesc, readClientId, reconcilePending } from '../lib/syncHelpers'

export type ContentCategory = 'book' | 'movie' | 'drama' | 'youtube' | 'etc'
export type ContentStatus = 'want' | 'watching' | 'done'

export interface ContentItem {
  id: string
  clientId?: string
  addedBy: string
  category: ContentCategory
  title: string
  memo: string | null
  url: string | null
  imageUrl: string | null
  imagePath: string | null
  status: ContentStatus
  rating: number | null
  review: string | null
  createdAt: number | null
}

function toItem(data: Record<string, unknown>, id: string): ContentItem {
  const ts = data['createdAt'] as Timestamp | null
  return {
    id,
    clientId: readClientId(data),
    addedBy: (data['addedBy'] as string) ?? '',
    category: (data['category'] as ContentCategory) ?? 'etc',
    title: (data['title'] as string) ?? '',
    memo: (data['memo'] as string | null) ?? null,
    url: (data['url'] as string | null) ?? null,
    imageUrl: (data['imageUrl'] as string | null) ?? null,
    imagePath: (data['imagePath'] as string | null) ?? null,
    status: (data['status'] as ContentStatus) ?? 'want',
    rating: (data['rating'] as number | null) ?? null,
    review: (data['review'] as string | null) ?? null,
    createdAt: ts?.toMillis() ?? null,
  }
}

export function useContents(coupleId: string | null, myUid: string | null) {
  const [items, setItems] = useState<ContentItem[]>([])
  const pendingRef = useRef(new Map<string, ContentItem>())

  const uploadContentImage = async (file: File, clientId: string) => {
    if (!coupleId || !myUid) return { imageUrl: null, imagePath: null }
    const safeName = file.name.replace(/[^\w.-]/g, '_') || 'content.jpg'
    const imagePath = `couples/${coupleId}/contents/${myUid}/${clientId}_${safeName}`
    const storageRef = ref(storage, imagePath)
    await uploadBytes(storageRef, file, { contentType: file.type || 'image/jpeg' })
    return { imageUrl: await getDownloadURL(storageRef), imagePath }
  }

  useEffect(() => {
    if (!coupleId) {
      pendingRef.current.clear()
      setItems([])
      return
    }

    const q = query(
      collection(db, 'couples', coupleId, 'contents'),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const server = snap.docs.map((d) => toItem(d.data() as Record<string, unknown>, d.id))
        reconcilePending(pendingRef.current, server, (p, s) =>
          p.addedBy === s.addedBy
          && p.title === s.title
          && p.category === s.category
          && p.createdAt != null
          && s.createdAt != null
          && Math.abs(p.createdAt - s.createdAt) < 120_000,
        (s) => s.clientId)
        setItems(mergeByCreatedAtDesc(server, [...pendingRef.current.values()]))
      },
      (err) => console.warn('[useContents] listener error', err),
    )
    return () => unsub()
  }, [coupleId])

  const addContent = async (data: {
    category: ContentCategory
    title: string
    memo?: string
    url?: string
    imageFile?: File | null
  }) => {
    if (!coupleId || !myUid) return
    const clientId = createClientId('content')
    const localImageUrl = data.imageFile ? URL.createObjectURL(data.imageFile) : null
    const optimistic: ContentItem = {
      id: createOptimisticId(clientId),
      clientId,
      addedBy: myUid,
      category: data.category,
      title: data.title,
      memo: data.memo ?? null,
      url: data.url ?? null,
      imageUrl: localImageUrl,
      imagePath: null,
      status: 'want',
      rating: null,
      review: null,
      createdAt: Date.now(),
    }
    pendingRef.current.set(optimistic.id, optimistic)
    setItems((prev) => mergeByCreatedAtDesc(prev.filter((i) => i.id !== optimistic.id), [optimistic]))

    try {
      const uploaded = data.imageFile
        ? await uploadContentImage(data.imageFile, clientId)
        : { imageUrl: null, imagePath: null }
      await addDoc(collection(db, 'couples', coupleId, 'contents'), {
        clientId,
        addedBy: myUid,
        category: data.category,
        title: data.title,
        memo: data.memo ?? null,
        url: data.url ?? null,
        imageUrl: uploaded.imageUrl,
        imagePath: uploaded.imagePath,
        status: 'want',
        rating: null,
        review: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn('[useContents] addContent failed', err)
      pendingRef.current.delete(optimistic.id)
      setItems((prev) => prev.filter((i) => i.id !== optimistic.id))
      if (localImageUrl) URL.revokeObjectURL(localImageUrl)
    }
  }

  const updateStatus = async (
    contentId: string,
    status: ContentStatus,
    extra?: { rating?: number; review?: string },
  ) => {
    let previous: ContentItem | undefined
    setItems((prev) => {
      previous = prev.find((i) => i.id === contentId)
      return prev.map((i) => i.id === contentId ? { ...i, status, ...extra } : i)
    })
    if (!coupleId || isOptimisticId(contentId)) return

    try {
      await updateDoc(doc(db, 'couples', coupleId, 'contents', contentId), {
        status,
        ...extra,
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn('[useContents] updateStatus failed', err)
      if (previous) {
        const rollback = previous
        setItems((prev) => prev.map((i) => i.id === contentId ? rollback : i))
      }
    }
  }

  const updateContent = async (
    contentId: string,
    data: {
      category: ContentCategory
      title: string
      memo?: string | null
      url?: string | null
      imageUrl?: string | null
      imagePath?: string | null
      imageFile?: File | null
      status: ContentStatus
      rating?: number | null
      review?: string | null
    },
  ) => {
    let previous: ContentItem | undefined
    setItems((prev) => {
      previous = prev.find((i) => i.id === contentId)
      return prev.map((item) => item.id === contentId ? { ...item, ...data } : item)
    })
    if (!coupleId || isOptimisticId(contentId)) return
    try {
      const uploaded = data.imageFile
        ? await uploadContentImage(data.imageFile, createClientId('content_img'))
        : { imageUrl: data.imageUrl ?? null, imagePath: data.imagePath ?? null }
      await updateDoc(doc(db, 'couples', coupleId, 'contents', contentId), {
        category: data.category,
        title: data.title,
        memo: data.memo ?? null,
        url: data.url ?? null,
        imageUrl: uploaded.imageUrl,
        imagePath: uploaded.imagePath,
        status: data.status,
        rating: data.status === 'done' ? data.rating ?? null : null,
        review: data.status === 'done' ? data.review ?? null : null,
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn('[useContents] updateContent failed', err)
      if (previous) {
        const rollback = previous
        setItems((prev) => prev.map((item) => item.id === contentId ? rollback : item))
      }
    }
  }

  const deleteContent = async (contentId: string) => {
    if (!coupleId || isOptimisticId(contentId)) return
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'contents', contentId))
    } catch (err) {
      console.warn('[useContents] deleteContent failed', err)
    }
  }

  return { items, addContent, updateStatus, updateContent, deleteContent }
}
