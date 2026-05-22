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
  createdAt: number | null   // ms epoch (null = optimistic)
  readBy: string[]
}

// localStorage 폴백 메시지 저장
const LS_KEY = (coupleId: string) => `tether_messages_${coupleId}`

function saveLocal(coupleId: string, messages: ChatMessage[]) {
  try {
    localStorage.setItem(LS_KEY(coupleId), JSON.stringify(messages.slice(-PAGE_SIZE)))
  } catch { /* ignore */ }
}

function loadLocal(coupleId: string): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY(coupleId)) ?? '[]') as ChatMessage[]
  } catch {
    return []
  }
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
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    coupleId ? loadLocal(coupleId) : [],
  )
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null)
  const [firebaseOk, setFirebaseOk] = useState(true)

  // 실시간 최신 30개 구독
  useEffect(() => {
    if (!coupleId) return
    let unsub: (() => void) | undefined

    try {
      const q = query(
        collection(db, 'couples', coupleId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      )

      unsub = onSnapshot(
        q,
        (snap) => {
          const docs = snap.docs
            .map((d) => toMessage(d.data(), d.id))
            .reverse()
          setMessages(docs)
          saveLocal(coupleId, docs)
          lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null
          setHasMore(snap.docs.length === PAGE_SIZE)
          setFirebaseOk(true)
        },
        () => {
          // Firebase 미설정 — 로컬 상태 유지
          setFirebaseOk(false)
          setHasMore(false)
        },
      )
    } catch {
      setFirebaseOk(false)
      setHasMore(false)
    }

    return () => unsub?.()
  }, [coupleId])

  // 이전 메시지 더 불러오기 (무한 스크롤)
  const loadMore = useCallback(async () => {
    if (!coupleId || !lastDocRef.current || !hasMore || loading || !firebaseOk) return
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
    } catch { /* ignore */ }
    setLoading(false)
  }, [coupleId, hasMore, loading, firebaseOk])

  // 텍스트 메시지 전송
  const sendText = useCallback(async (text: string) => {
    if (!text.trim() || !coupleId || !myUid) return

    // Optimistic update
    const optimistic: ChatMessage = {
      id: `opt_${Date.now()}`,
      senderUid: myUid,
      type: 'text',
      text: text.trim(),
      createdAt: Date.now(),
      readBy: [myUid],
    }
    setMessages((prev) => [...prev, optimistic])

    if (!firebaseOk) return
    try {
      await addDoc(collection(db, 'couples', coupleId, 'messages'), {
        senderUid: myUid,
        type: 'text',
        text: text.trim(),
        createdAt: serverTimestamp(),
        readBy: [myUid],
      })
    } catch { /* Firebase 미설정 — optimistic 메시지만 유지 */ }
  }, [coupleId, myUid, firebaseOk])

  // 이미지 업로드 + 전송
  const sendImage = useCallback(async (file: File) => {
    if (!coupleId || !myUid) return

    // Optimistic: 로컬 object URL로 즉시 표시
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

    if (!firebaseOk) return
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
    } catch { /* Firebase 미설정 */ }
  }, [coupleId, myUid, firebaseOk])

  // 읽음 표시
  const markAsRead = useCallback(async (messageId: string) => {
    if (!coupleId || !myUid || !firebaseOk) return
    try {
      await updateDoc(
        doc(db, 'couples', coupleId, 'messages', messageId),
        { readBy: arrayUnion(myUid) },
      )
    } catch { /* ignore */ }
  }, [coupleId, myUid, firebaseOk])

  return { messages, hasMore, loading, loadMore, sendText, sendImage, markAsRead }
}
