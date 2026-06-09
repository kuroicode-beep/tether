import { useState, useEffect, useRef } from 'react'
import {
  collection, addDoc, onSnapshot, doc,
  updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { isOptimisticId, mergeByCreatedAtDesc, reconcilePending } from '../lib/syncHelpers'

export interface DiaryReply {
  authorUid: string
  content: string
  imageUrl: string | null
  createdAt: number | null
}

export interface DiaryEntry {
  id: string
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
        )
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

    const optimistic: DiaryEntry = {
      id: `opt_${Date.now()}`,
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
    setEntries((prev) => prev.map((e) => e.id === diaryId ? { ...e, isRead: true } : e))
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'diary', diaryId), { isRead: true })
    } catch (err) {
      console.warn('[useDiary] markDiaryRead failed', err)
    }
  }

  const writeReply = async (
    diaryId: string,
    data: { content: string; imageFile?: File },
  ) => {
    if (!coupleId || !myUid) return
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

    const reply: DiaryReply = {
      authorUid: myUid,
      content: data.content,
      imageUrl,
      createdAt: Date.now(),
    }
    setEntries((prev) => prev.map((e) => e.id === diaryId ? { ...e, reply } : e))

    if (isOptimisticId(diaryId)) return
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'diary', diaryId), {
        reply: { authorUid: myUid, content: data.content, imageUrl, createdAt: serverTimestamp() },
      })
    } catch (err) {
      console.warn('[useDiary] writeReply failed', err)
    }
  }

  const updateDiary = async (
    diaryId: string,
    data: { title: string; content: string },
  ) => {
    if (!coupleId || isOptimisticId(diaryId)) return
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'diary', diaryId), {
        title: data.title,
        content: data.content,
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
