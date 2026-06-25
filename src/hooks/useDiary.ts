import { useState, useEffect, useRef } from 'react'
import {
  collection, addDoc, onSnapshot, doc,
  updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { createClientId, createOptimisticId } from '../lib/clientId'
import { isOptimisticId, mergeByCreatedAtDesc, readClientId, reconcilePending } from '../lib/syncHelpers'

export interface DiaryReply {
  authorUid: string
  content: string
  imageUrl: string | null
  createdAt: number | null
  clientId?: string
}

export interface DiaryEntry {
  id: string
  clientId?: string
  authorUid: string
  title: string
  content: string
  imageUrl: string | null
  createdAt: number | null
  isRead: boolean
  reply: DiaryReply | null
}

function toEntry(data: Record<string, unknown>, id: string): DiaryEntry {
  const ts = data['createdAt'] as Timestamp | null
  const reply = data['reply'] as Record<string, unknown> | null
  return {
    id,
    clientId: readClientId(data),
    authorUid: (data['authorUid'] as string) ?? '',
    title: (data['title'] as string) ?? '',
    content: (data['content'] as string) ?? '',
    imageUrl: (data['imageUrl'] as string | null) ?? null,
    createdAt: ts?.toMillis() ?? null,
    isRead: (data['isRead'] as boolean) ?? false,
    reply: reply
      ? {
          authorUid: (reply['authorUid'] as string) ?? '',
          content: (reply['content'] as string) ?? '',
          imageUrl: (reply['imageUrl'] as string | null) ?? null,
          createdAt: (reply['createdAt'] as Timestamp | null)?.toMillis() ?? null,
          clientId: readClientId(reply),
        }
      : null,
  }
}

export function useDiary(coupleId: string | null, myUid: string | null) {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const pendingRef = useRef(new Map<string, DiaryEntry>())

  useEffect(() => {
    if (!coupleId) {
      pendingRef.current.clear()
      setEntries([])
      return
    }

    const q = query(
      collection(db, 'couples', coupleId, 'diary'),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const server = snap.docs.map((d) => toEntry(d.data() as Record<string, unknown>, d.id))
        reconcilePending(pendingRef.current, server, (p, s) =>
          p.authorUid === s.authorUid
          && p.title === s.title
          && p.createdAt != null
          && s.createdAt != null
          && Math.abs(p.createdAt - s.createdAt) < 120_000,
        (s) => s.clientId)
        setEntries(mergeByCreatedAtDesc(server, [...pendingRef.current.values()]))
      },
      (err) => console.warn('[useDiary] listener error', err),
    )
    return () => unsub()
  }, [coupleId])

  const writeDiary = async (data: { title: string; content: string; imageFile?: File }) => {
    if (!coupleId || !myUid) return
    let imageUrl: string | null = null
    if (data.imageFile) {
      try {
        const path = `couples/${coupleId}/diary/${Date.now()}_${data.imageFile.name}`
        await uploadBytes(ref(storage, path), data.imageFile)
        imageUrl = await getDownloadURL(ref(storage, path))
      } catch (err) {
        console.warn('[useDiary] image upload failed', err)
        imageUrl = null
      }
    }

    const clientId = createClientId('diary')
    const optimistic: DiaryEntry = {
      id: createOptimisticId(clientId),
      clientId,
      authorUid: myUid,
      title: data.title,
      content: data.content,
      imageUrl,
      createdAt: Date.now(),
      isRead: false,
      reply: null,
    }
    pendingRef.current.set(optimistic.id, optimistic)
    setEntries((prev) => mergeByCreatedAtDesc(prev.filter((e) => e.id !== optimistic.id), [optimistic]))

    try {
      await addDoc(collection(db, 'couples', coupleId, 'diary'), {
        clientId,
        authorUid: myUid,
        title: data.title,
        content: data.content,
        imageUrl,
        createdAt: serverTimestamp(),
        isRead: false,
        reply: null,
      })
    } catch (err) {
      console.warn('[useDiary] writeDiary failed', err)
      pendingRef.current.delete(optimistic.id)
      setEntries((prev) => prev.filter((e) => e.id !== optimistic.id))
    }
  }

  const markDiaryRead = async (diaryId: string) => {
    if (!coupleId || isOptimisticId(diaryId)) return
    let previousIsRead = false
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === diaryId)
      previousIsRead = entry?.isRead ?? false
      return prev.map((e) => e.id === diaryId ? { ...e, isRead: true } : e)
    })
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'diary', diaryId), { isRead: true })
    } catch (err) {
      console.warn('[useDiary] markDiaryRead failed', err)
      const rollback = previousIsRead
      setEntries((prev) => prev.map((e) => e.id === diaryId ? { ...e, isRead: rollback } : e))
    }
  }

  const writeReply = async (
    diaryId: string,
    data: { content: string; imageFile?: File },
  ): Promise<DiaryReply | null> => {
    if (!coupleId || !myUid) return null
    let imageUrl: string | null = null
    if (data.imageFile) {
      try {
        const path = `couples/${coupleId}/diary/${diaryId}/reply_${Date.now()}`
        await uploadBytes(ref(storage, path), data.imageFile)
        imageUrl = await getDownloadURL(ref(storage, path))
      } catch (err) {
        console.warn('[useDiary] reply image upload failed', err)
        imageUrl = null
      }
    }

    const clientId = createClientId('reply')
    const reply: DiaryReply = {
      authorUid: myUid,
      content: data.content,
      imageUrl,
      createdAt: Date.now(),
      clientId,
    }

    let previousReply: DiaryReply | null = null
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === diaryId)
      previousReply = entry?.reply ?? null
      return prev.map((e) => e.id === diaryId ? { ...e, reply } : e)
    })

    if (isOptimisticId(diaryId)) return null
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'diary', diaryId), {
        reply: {
          authorUid: myUid,
          content: data.content,
          imageUrl,
          createdAt: serverTimestamp(),
          clientId,
        },
      })
      return reply
    } catch (err) {
      console.warn('[useDiary] writeReply failed', err)
      const rollback = previousReply
      setEntries((prev) => prev.map((e) => e.id === diaryId ? { ...e, reply: rollback } : e))
      return null
    }
  }

  const updateDiary = async (
    diaryId: string,
    data: { title: string; content: string; imageFile?: File; imageUrl?: string | null },
  ) => {
    if (!coupleId || isOptimisticId(diaryId)) return
    let imageUrl = data.imageUrl
    if (data.imageFile) {
      try {
        const path = `couples/${coupleId}/diary/${diaryId}/edit_${Date.now()}_${data.imageFile.name}`
        await uploadBytes(ref(storage, path), data.imageFile)
        imageUrl = await getDownloadURL(ref(storage, path))
      } catch (err) {
        console.warn('[useDiary] update image upload failed', err)
      }
    }

    try {
      await updateDoc(doc(db, 'couples', coupleId, 'diary', diaryId), {
        title: data.title,
        content: data.content,
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn('[useDiary] updateDiary failed', err)
    }
  }

  const deleteDiary = async (diaryId: string) => {
    if (!coupleId || isOptimisticId(diaryId)) return
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'diary', diaryId))
    } catch (err) {
      console.warn('[useDiary] deleteDiary failed', err)
    }
  }

  return { entries, writeDiary, markDiaryRead, writeReply, updateDiary, deleteDiary }
}
