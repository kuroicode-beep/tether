import { useState, useEffect, useRef, useCallback } from 'react'
import {
  collection, addDoc, onSnapshot,
  query, orderBy, limit, startAfter,
  Timestamp, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion, getDocs, writeBatch,
  QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { debugLog } from '../lib/debugLog'
import {
  isOptimisticId,
  mergeChatMessages,
  reconcilePending,
  revokeBlobUrl,
} from '../lib/syncHelpers'

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

function chatMatchesPending(p: ChatMessage, s: ChatMessage): boolean {
  if (p.senderUid !== s.senderUid || p.type !== s.type) return false
  if (p.type === 'text' && s.type === 'text') return p.text === s.text
  if (p.type === 'image' && s.type === 'image') {
    return p.createdAt != null && s.createdAt != null
      && Math.abs(p.createdAt - s.createdAt) < 120_000
  }
  return false
}

export function useChat(coupleId: string | null, myUid: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null)
  const olderRef = useRef<ChatMessage[]>([])
  const liveRef = useRef<ChatMessage[]>([])
  const pendingRef = useRef(new Map<string, ChatMessage>())

  const applyMerge = useCallback(() => {
    setMessages(mergeChatMessages(
      olderRef.current,
      liveRef.current,
      [...pendingRef.current.values()],
    ))
  }, [])

  useEffect(() => {
    if (!coupleId) {
      setMessages([])
      setHasMore(false)
      lastDocRef.current = null
      olderRef.current = []
      liveRef.current = []
      pendingRef.current.clear()
      return
    }

    olderRef.current = []
    liveRef.current = []
    pendingRef.current.clear()

    const q = query(
      collection(db, 'couples', coupleId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const live = snap.docs.map((d) => toMessage(d.data(), d.id)).reverse()
        liveRef.current = live
        lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null
        setHasMore(snap.docs.length === PAGE_SIZE)
        reconcilePending(pendingRef.current, live, chatMatchesPending)
        applyMerge()
      },
      (err) => {
        console.warn('[useChat] listener error', err)
        setHasMore(false)
      },
    )

    return () => unsub()
  }, [coupleId, applyMerge])

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
      const existingIds = new Set([
        ...olderRef.current.map((m) => m.id),
        ...liveRef.current.map((m) => m.id),
      ])
      olderRef.current = [...older.filter((m) => !existingIds.has(m.id)), ...olderRef.current]
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null
      setHasMore(snap.docs.length === PAGE_SIZE)
      applyMerge()
    } catch (err) {
      console.warn('[useChat] loadMore failed', err)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [coupleId, hasMore, loading, applyMerge])

  const failOptimistic = useCallback((id: string) => {
    const item = pendingRef.current.get(id)
    if (item) {
      revokeBlobUrl(item.imageUrl)
      pendingRef.current.delete(id)
      applyMerge()
    }
  }, [applyMerge])

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
    pendingRef.current.set(optimistic.id, optimistic)
    applyMerge()

    try {
      const createdAt = Timestamp.now()
      await addDoc(collection(db, 'couples', coupleId, 'messages'), {
        senderUid: myUid,
        type: 'text',
        text: text.trim(),
        createdAt,
        readBy: [myUid],
      })
    } catch (err) {
      console.warn('[useChat] sendText failed', err)
      failOptimistic(optimistic.id)
    }
  }, [coupleId, myUid, applyMerge, failOptimistic])

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
    pendingRef.current.set(optimistic.id, optimistic)
    applyMerge()

    try {
      const safeName = file.name.replace(/[^\w.\-]/g, '_')
      const path = `couples/${coupleId}/images/${Date.now()}_${safeName}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file, {
        contentType: file.type || 'image/jpeg',
      })
      const imageUrl = await getDownloadURL(storageRef)
      const createdAt = Timestamp.now()
      await addDoc(collection(db, 'couples', coupleId, 'messages'), {
        senderUid: myUid,
        type: 'image',
        imageUrl,
        createdAt,
        readBy: [myUid],
      })
    } catch (err) {
      console.warn('[useChat] sendImage failed', err)
      failOptimistic(optimistic.id)
    }
  }, [coupleId, myUid, applyMerge, failOptimistic])

  const markManyAsRead = useCallback(async (messageIds: string[]) => {
    if (!coupleId || !myUid || messageIds.length === 0) return
    const ids = messageIds.filter((id) => !isOptimisticId(id))
    if (ids.length === 0) return
    try {
      const batch = writeBatch(db)
      ids.forEach((messageId) => {
        batch.update(doc(db, 'couples', coupleId, 'messages', messageId), {
          readBy: arrayUnion(myUid),
        })
      })
      await batch.commit()
      debugLog('useChat.ts:markManyAsRead', 'ok', { count: ids.length }, 'H5')
    } catch (error) {
      const code = (error as { code?: string })?.code ?? 'unknown'
      debugLog('useChat.ts:markManyAsRead', 'fail', { code, count: ids.length }, 'H5')
      console.warn('[useChat] markManyAsRead failed', error)
    }
  }, [coupleId, myUid])

  const updateMessage = useCallback(async (messageId: string, text: string) => {
    if (!coupleId || !myUid || isOptimisticId(messageId) || !text.trim()) return
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'messages', messageId), {
        text: text.trim(),
        editedAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn('[useChat] updateMessage failed', err)
    }
  }, [coupleId, myUid])

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!coupleId || isOptimisticId(messageId)) return
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'messages', messageId))
    } catch (err) {
      console.warn('[useChat] deleteMessage failed', err)
    }
  }, [coupleId])

  return { messages, hasMore, loading, loadMore, sendText, sendImage, markManyAsRead, updateMessage, deleteMessage }
}
