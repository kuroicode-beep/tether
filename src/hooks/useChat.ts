import { useState, useEffect, useRef, useCallback } from 'react'
import {
  collection, addDoc, onSnapshot,
  query, orderBy, limit, startAfter,
  serverTimestamp, doc, updateDoc, arrayUnion, getDocs,
  QueryDocumentSnapshot, DocumentData, Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'

const PAGE_SIZE = 30

export interface ChatMessage {
  id: string
  senderUid: string
  type: 'text' | 'image'
  text?: string
  imageUrl?: string
  createdAt: number | null
  readBy: string[]
}

function toMessage(d: DocumentData, id: string): ChatMessage {
  const ts = d['createdAt'] as Timestamp | null
  return {
    id,
    senderUid: d['senderUid'] as string ?? '',
    type: (d['type'] as 'text' | 'image') ?? 'text',
    text: d['text'] as string | undefined,
    imageUrl: d['imageUrl'] as string | undefined,
    createdAt: ts?.toMillis() ?? null,
    readBy: (d['readBy'] as string[]) ?? [],
  }
}

export function useChat(coupleId: string | null, myUid: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null)

  useEffect(() => {
    if (!coupleId) {
      setMessages([])
      setHasMore(false)
      lastDocRef.current = null
      return
    }

    const q = query(
      collection(db, 'couples', coupleId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => toMessage(d.data(), d.id)).reverse()
        setMessages(docs)
        lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null
        setHasMore(snap.docs.length === PAGE_SIZE)
      },
      () => setHasMore(false),
    )

    return () => unsub()
  }, [coupleId])

  const loadMore = useCallback(async () => {
    if (!coupleId || !lastDocRef.current || !hasMore || loading) return
    setLoading(true)
    try {
      const q = query(
        collection(db, 'couples', coupleId, 'messages'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(PAGE_SIZE),
      )
      const snap = await getDocs(q)
      const older = snap.docs.map((d) => toMessage(d.data(), d.id)).reverse()
      setMessages((prev) => [...older, ...prev])
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null
      setHasMore(snap.docs.length === PAGE_SIZE)
    } catch {
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [coupleId, hasMore, loading])

  const sendText = useCallback(async (text: string) => {
    if (!text.trim() || !coupleId || !myUid) return

    const optimistic: ChatMessage = {
      id: `opt_${Date.now()}`,
      senderUid: myUid,
      type: 'text',
      text: text.trim(),
      createdAt: Date.now(),
      readBy: [myUid],
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      await addDoc(collection(db, 'couples', coupleId, 'messages'), {
        senderUid: myUid,
        type: 'text',
        text: text.trim(),
        createdAt: serverTimestamp(),
        readBy: [myUid],
      })
    } catch { /* ignore */ }
  }, [coupleId, myUid])

  const sendImage = useCallback(async (file: File) => {
    if (!coupleId || !myUid) return

    const localUrl = URL.createObjectURL(file)
    const optimistic: ChatMessage = {
      id: `opt_img_${Date.now()}`,
      senderUid: myUid,
      type: 'image',
      imageUrl: localUrl,
      createdAt: Date.now(),
      readBy: [myUid],
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const path = `couples/${coupleId}/images/${Date.now()}_${file.name}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      const imageUrl = await getDownloadURL(storageRef)
      await addDoc(collection(db, 'couples', coupleId, 'messages'), {
        senderUid: myUid,
        type: 'image',
        imageUrl,
        createdAt: serverTimestamp(),
        readBy: [myUid],
      })
    } catch { /* ignore */ }
  }, [coupleId, myUid])

  const markAsRead = useCallback(async (messageId: string) => {
    if (!coupleId || !myUid || messageId.startsWith('opt_')) return
    try {
      await updateDoc(
        doc(db, 'couples', coupleId, 'messages', messageId),
        { readBy: arrayUnion(myUid) },
      )
    } catch { /* ignore */ }
  }, [coupleId, myUid])

  return { messages, hasMore, loading, loadMore, sendText, sendImage, markAsRead }
}
