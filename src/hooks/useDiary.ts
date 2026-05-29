import { useState, useEffect } from 'react'
import {
  collection, addDoc, onSnapshot, doc,
  updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'

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

  useEffect(() => {
    if (!coupleId) {
      setEntries([])
      return
    }

    const q = query(
      collection(db, 'couples', coupleId, 'diary'),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => toEntry(d.data() as Record<string, unknown>, d.id)))
    })
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
      } catch { imageUrl = null }
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
    setEntries((prev) => [optimistic, ...prev])

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
    } catch { /* ignore */ }
  }

  const markDiaryRead = async (diaryId: string) => {
    if (!coupleId || diaryId.startsWith('opt_')) return
    setEntries((prev) => prev.map((e) => e.id === diaryId ? { ...e, isRead: true } : e))
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'diary', diaryId), { isRead: true })
    } catch { /* ignore */ }
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
      } catch { imageUrl = null }
    }

    const reply: DiaryReply = {
      authorUid: myUid,
      content: data.content,
      imageUrl,
      createdAt: Date.now(),
    }
    setEntries((prev) => prev.map((e) => e.id === diaryId ? { ...e, reply } : e))

    if (diaryId.startsWith('opt_')) return
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'diary', diaryId), {
        reply: { authorUid: myUid, content: data.content, imageUrl, createdAt: serverTimestamp() },
      })
    } catch { /* ignore */ }
  }

  const updateDiary = async (
    diaryId: string,
    data: { title: string; content: string },
  ) => {
    if (!coupleId || diaryId.startsWith('opt_')) return
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'diary', diaryId), {
        title: data.title,
        content: data.content,
        updatedAt: serverTimestamp(),
      })
    } catch { /* ignore */ }
  }

  const deleteDiary = async (diaryId: string) => {
    if (!coupleId || diaryId.startsWith('opt_')) return
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'diary', diaryId))
    } catch { /* ignore */ }
  }

  return { entries, writeDiary, markDiaryRead, writeReply, updateDiary, deleteDiary }
}
