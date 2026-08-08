import { useState, useEffect, useRef, useCallback } from 'react'
import {
  collection, addDoc, onSnapshot,
  query, orderBy, limit, where,
  Timestamp, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion, getDocs, writeBatch, setDoc,
  DocumentData,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { debugLog } from '../lib/debugLog'
import { createClientId, createOptimisticId } from '../lib/clientId'
import {
  isOptimisticId,
  mergeChatMessages,
  readClientId,
  reconcilePending,
  revokeBlobUrl,
} from '../lib/syncHelpers'

const PAGE_SIZE = 30

export interface ChatMessage {
  id: string
  clientId?: string
  senderUid: string
  type: 'text' | 'image' | 'file'
  text?: string
  imageUrl?: string
  fileUrl?: string
  fileName?: string
  fileType?: string
  fileSize?: number
  createdAt: number | null
  readBy: string[]
  // 릴레이소설 — 일반 채팅과 구분해 렌더하기 위한 표시
  relayNovelId?: string
  relayTurn?: number
  relayKind?: 'turn' | 'system' | 'assist'
  relayAuthorName?: string
  // 게임(오목 등) 안내 메시지 표시
  gameKind?: 'system'
  gameId?: string
}

// 메시지에 함께 저장할 부가 정보 (릴레이소설·게임 등)
export type ChatMessageMeta = Pick<
  ChatMessage,
  'relayNovelId' | 'relayTurn' | 'relayKind' | 'relayAuthorName' | 'gameKind' | 'gameId'
>

function toMessage(d: DocumentData, id: string): ChatMessage {
  const ts = d['createdAt'] as Timestamp | null
  return {
    id,
    clientId: readClientId(d),
    senderUid: d['senderUid'] as string ?? '',
    type: (d['type'] as 'text' | 'image' | 'file') ?? 'text',
    text: d['text'] as string | undefined,
    imageUrl: d['imageUrl'] as string | undefined,
    fileUrl: d['fileUrl'] as string | undefined,
    fileName: d['fileName'] as string | undefined,
    fileType: d['fileType'] as string | undefined,
    fileSize: d['fileSize'] as number | undefined,
    createdAt: ts?.toMillis() ?? null,
    readBy: (d['readBy'] as string[]) ?? [],
    relayNovelId: d['relayNovelId'] as string | undefined,
    relayTurn: d['relayTurn'] as number | undefined,
    relayKind: d['relayKind'] as ChatMessage['relayKind'],
    relayAuthorName: d['relayAuthorName'] as string | undefined,
    gameKind: d['gameKind'] as ChatMessage['gameKind'],
    gameId: d['gameId'] as string | undefined,
  }
}

// undefined 필드를 걸러 Firestore에 그대로 넘길 수 있게 만든다
function cleanMeta(meta?: ChatMessageMeta): Record<string, unknown> {
  if (!meta) return {}
  return Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined),
  )
}

function chatMatchesPending(p: ChatMessage, s: ChatMessage): boolean {
  if (p.senderUid !== s.senderUid || p.type !== s.type) return false
  if (p.type === 'text' && s.type === 'text') return p.text === s.text
  if (p.type === 'image' && s.type === 'image') {
    return p.createdAt != null && s.createdAt != null
      && Math.abs(p.createdAt - s.createdAt) < 120_000
  }
  if (p.type === 'file' && s.type === 'file') {
    return p.fileName === s.fileName
      && p.createdAt != null
      && s.createdAt != null
      && Math.abs(p.createdAt - s.createdAt) < 120_000
  }
  return false
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-가-힣]/g, '_') || 'file'
}

// 파일 확장자 기반으로 누락된 MIME과 텍스트 인코딩을 보강한다.
function inferFileContentType(file: File): string {
  if (file.type) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'text/markdown; charset=utf-8'
  if (name.endsWith('.txt')) return 'text/plain; charset=utf-8'
  if (name.endsWith('.csv')) return 'text/csv; charset=utf-8'
  if (name.endsWith('.json')) return 'application/json; charset=utf-8'
  if (name.endsWith('.mp3')) return 'audio/mpeg'
  if (name.endsWith('.m4a')) return 'audio/mp4'
  if (name.endsWith('.aac')) return 'audio/aac'
  if (name.endsWith('.wav')) return 'audio/wav'
  if (name.endsWith('.ogg')) return 'audio/ogg'
  return 'application/octet-stream'
}

export function useChat(coupleId: string | null, myUid: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  // 오늘 0시 기준 — 처음엔 오늘 메시지만 구독하고, 이전은 버튼으로 불러온다
  const todayStartRef = useRef<number>(0)
  const olderRef = useRef<ChatMessage[]>([])
  const liveRef = useRef<ChatMessage[]>([])
  const pendingRef = useRef(new Map<string, ChatMessage>())
  const lastSentTextRef = useRef<{ text: string; at: number } | null>(null)

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
      olderRef.current = []
      liveRef.current = []
      pendingRef.current.clear()
      return
    }

    olderRef.current = []
    liveRef.current = []
    pendingRef.current.clear()

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    todayStartRef.current = todayStart.getTime()

    const messagesRef = collection(db, 'couples', coupleId, 'messages')

    // 오늘 보낸 메시지만 실시간 구독한다 (이전 내용은 loadMore로 가져온다)
    const q = query(
      messagesRef,
      where('createdAt', '>=', Timestamp.fromDate(todayStart)),
      orderBy('createdAt', 'asc'),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        // serverTimestamp가 아직 확정되지 않은 내 메시지는 추정치로 정렬한다
        const live = snap.docs.map((d) => toMessage(d.data({ serverTimestamps: 'estimate' }), d.id))
        liveRef.current = live
        reconcilePending(pendingRef.current, live, chatMatchesPending, (s) => s.clientId)
        applyMerge()
      },
      (err) => {
        console.warn('[useChat] listener error', err)
        setHasMore(false)
      },
    )

    // 오늘 이전 메시지가 있는지 확인해 "이전 내용 보기" 버튼 노출 여부를 정한다
    getDocs(query(
      messagesRef,
      where('createdAt', '<', Timestamp.fromDate(todayStart)),
      orderBy('createdAt', 'desc'),
      limit(1),
    ))
      .then((snap) => setHasMore(!snap.empty))
      .catch((err) => {
        console.warn('[useChat] hasMore check failed', err)
        setHasMore(false)
      })

    return () => unsub()
  }, [coupleId, applyMerge])

  const loadMore = useCallback(async () => {
    if (!coupleId || !hasMore || loading) return
    setLoading(true)
    try {
      // 이미 불러온 가장 오래된 메시지(없으면 오늘 0시)보다 이전 것을 가져온다
      const boundary = olderRef.current[0]?.createdAt ?? todayStartRef.current
      const q = query(
        collection(db, 'couples', coupleId, 'messages'),
        where('createdAt', '<', Timestamp.fromMillis(boundary)),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      )
      const snap = await getDocs(q)
      const older = snap.docs.map((d) => toMessage(d.data(), d.id)).reverse()
      const existingIds = new Set([
        ...olderRef.current.map((m) => m.id),
        ...liveRef.current.map((m) => m.id),
      ])
      olderRef.current = [...older.filter((m) => !existingIds.has(m.id)), ...olderRef.current]
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
      revokeBlobUrl(item.fileUrl)
      pendingRef.current.delete(id)
      applyMerge()
    }
  }, [applyMerge])

  const sendText = useCallback(async (text: string, meta?: ChatMessageMeta) => {
    const trimmed = text.trim()
    if (!trimmed || !coupleId || !myUid) return

    const lastSent = lastSentTextRef.current
    const now = Date.now()
    const isTrailingImeDuplicate =
      !!lastSent
      && now - lastSent.at < 3000
      && trimmed.length <= 2
      && lastSent.text.length > trimmed.length
      && lastSent.text.endsWith(trimmed)

    if (isTrailingImeDuplicate) {
      debugLog('useChat.ts:sendText', 'skip_trailing_ime_duplicate', {
        textLength: trimmed.length,
        previousLength: lastSent.text.length,
      }, 'H4')
      return
    }

    const clientId = createClientId('msg')
    const optimistic: ChatMessage = {
      id: createOptimisticId(clientId),
      clientId,
      senderUid: myUid,
      type: 'text',
      text: trimmed,
      createdAt: now,
      readBy: [myUid],
      ...meta,
    }
    pendingRef.current.set(optimistic.id, optimistic)
    lastSentTextRef.current = { text: trimmed, at: now }
    applyMerge()

    try {
      // 기기 시계 차이로 순서가 꼬이지 않도록 서버 시간을 쓴다
      await addDoc(collection(db, 'couples', coupleId, 'messages'), {
        clientId,
        senderUid: myUid,
        type: 'text',
        text: trimmed,
        createdAt: serverTimestamp(),
        readBy: [myUid],
        ...cleanMeta(meta),
      })
    } catch (err) {
      console.warn('[useChat] sendText failed', err)
      failOptimistic(optimistic.id)
    }
  }, [coupleId, myUid, applyMerge, failOptimistic])

  // 사진 전송 — caption은 선택 입력이며 text 필드에 함께 저장한다
  const sendImage = useCallback(async (file: File, caption?: string) => {
    if (!coupleId || !myUid) return

    const trimmedCaption = caption?.trim() ?? ''
    const clientId = createClientId('img')
    const localUrl = URL.createObjectURL(file)
    const optimistic: ChatMessage = {
      id: createOptimisticId(clientId),
      clientId,
      senderUid: myUid,
      type: 'image',
      text: trimmedCaption || undefined,
      imageUrl: localUrl,
      createdAt: Date.now(),
      readBy: [myUid],
    }
    pendingRef.current.set(optimistic.id, optimistic)
    applyMerge()

    try {
      const safeName = file.name.replace(/[^\w.-]/g, '_')
      const path = `couples/${coupleId}/images/${myUid}/${clientId}_${safeName}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file, {
        contentType: file.type || 'image/jpeg',
      })
      const imageUrl = await getDownloadURL(storageRef)
      await addDoc(collection(db, 'couples', coupleId, 'messages'), {
        clientId,
        senderUid: myUid,
        type: 'image',
        imageUrl,
        ...(trimmedCaption ? { text: trimmedCaption } : {}),
        createdAt: serverTimestamp(),
        readBy: [myUid],
      })
    } catch (err) {
      console.warn('[useChat] sendImage failed', err)
      failOptimistic(optimistic.id)
    }
  }, [coupleId, myUid, applyMerge, failOptimistic])

  // 파일 전송 — caption은 선택 입력이며 text 필드에 함께 저장한다
  const sendFile = useCallback(async (file: File, caption?: string) => {
    if (!coupleId || !myUid) return
    if (file.type.startsWith('image/')) {
      await sendImage(file, caption)
      return
    }

    const trimmedCaption = caption?.trim() ?? ''
    const clientId = createClientId('file')
    const localUrl = URL.createObjectURL(file)
    const contentType = inferFileContentType(file)
    const optimistic: ChatMessage = {
      id: createOptimisticId(clientId),
      clientId,
      senderUid: myUid,
      type: 'file',
      text: trimmedCaption || undefined,
      fileUrl: localUrl,
      fileName: file.name || 'file',
      fileType: contentType,
      fileSize: file.size,
      createdAt: Date.now(),
      readBy: [myUid],
    }
    pendingRef.current.set(optimistic.id, optimistic)
    applyMerge()

    try {
      const path = `couples/${coupleId}/files/${myUid}/${clientId}_${safeFileName(file.name)}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file, {
        contentType,
        customMetadata: {
          originalName: file.name || 'file',
        },
      })
      const fileUrl = await getDownloadURL(storageRef)
      const messageRef = await addDoc(collection(db, 'couples', coupleId, 'messages'), {
        clientId,
        senderUid: myUid,
        type: 'file',
        fileUrl,
        fileName: file.name || 'file',
        fileType: contentType,
        fileSize: file.size,
        ...(trimmedCaption ? { text: trimmedCaption } : {}),
        createdAt: serverTimestamp(),
        readBy: [myUid],
      })
      await setDoc(doc(db, 'couples', coupleId, 'files', messageRef.id), {
        messageId: messageRef.id,
        clientId,
        senderUid: myUid,
        fileUrl,
        fileName: file.name || 'file',
        fileType: contentType,
        fileSize: file.size,
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn('[useChat] sendFile failed', err)
      failOptimistic(optimistic.id)
    }
  }, [coupleId, myUid, sendImage, applyMerge, failOptimistic])

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

  return { messages, hasMore, loading, loadMore, sendText, sendImage, sendFile, markManyAsRead, updateMessage, deleteMessage }
}
