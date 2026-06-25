import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { createClientId } from '../lib/clientId'

export type LibraryFileItem = {
  id: string
  senderUid: string
  fileUrl: string
  fileName: string
  fileType: string
  fileSize: number | null
  createdAt: number | null
}

export type SharedLinkItem = {
  id: string
  title: string
  url: string
  summary: string | null
  fileUrl: string | null
  fileName: string | null
  createdBy: string
  createdAt: number | null
}

export type DateRecipeItem = {
  id: string
  date: string
  food: string
  memo: string | null
  createdBy: string
  createdAt: number | null
}

type AddLinkData = {
  title: string
  url: string
  summary?: string
  file?: File | null
}

type AddRecipeData = {
  date: string
  food: string
  memo?: string
}

function toMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-가-힣]/g, '_') || 'shortcut'
}

export function useLibrary(coupleId: string | null, myUid: string | null) {
  const [files, setFiles] = useState<LibraryFileItem[]>([])
  const [links, setLinks] = useState<SharedLinkItem[]>([])
  const [recipes, setRecipes] = useState<DateRecipeItem[]>([])

  useEffect(() => {
    if (!coupleId) {
      setFiles([])
      return
    }
    const q = query(
      collection(db, 'couples', coupleId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(120),
    )
    return onSnapshot(q, (snap) => {
      setFiles(snap.docs
        .map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>
          if (data.type !== 'file' || typeof data.fileUrl !== 'string') return null
          return {
            id: docSnap.id,
            senderUid: typeof data.senderUid === 'string' ? data.senderUid : '',
            fileUrl: data.fileUrl,
            fileName: typeof data.fileName === 'string' ? data.fileName : 'file',
            fileType: typeof data.fileType === 'string' ? data.fileType : 'application/octet-stream',
            fileSize: typeof data.fileSize === 'number' ? data.fileSize : null,
            createdAt: toMillis(data.createdAt),
          }
        })
        .filter((item): item is LibraryFileItem => item !== null))
    })
  }, [coupleId])

  useEffect(() => {
    if (!coupleId) {
      setLinks([])
      return
    }
    const q = query(collection(db, 'couples', coupleId, 'links'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setLinks(snap.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>
        return {
          id: docSnap.id,
          title: typeof data.title === 'string' ? data.title : '',
          url: typeof data.url === 'string' ? data.url : '',
          summary: typeof data.summary === 'string' ? data.summary : null,
          fileUrl: typeof data.fileUrl === 'string' ? data.fileUrl : null,
          fileName: typeof data.fileName === 'string' ? data.fileName : null,
          createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
          createdAt: toMillis(data.createdAt),
        }
      }))
    })
  }, [coupleId])

  useEffect(() => {
    if (!coupleId) {
      setRecipes([])
      return
    }
    const q = query(collection(db, 'couples', coupleId, 'dateRecipes'), orderBy('date', 'desc'))
    return onSnapshot(q, (snap) => {
      setRecipes(snap.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>
        return {
          id: docSnap.id,
          date: typeof data.date === 'string' ? data.date : '',
          food: typeof data.food === 'string' ? data.food : '',
          memo: typeof data.memo === 'string' ? data.memo : null,
          createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
          createdAt: toMillis(data.createdAt),
        }
      }))
    })
  }, [coupleId])

  const addLink = useCallback(async (data: AddLinkData) => {
    if (!coupleId || !myUid || !data.title.trim() || !data.url.trim()) return
    let fileUrl: string | null = null
    let fileName: string | null = null
    if (data.file) {
      const clientId = createClientId('link_file')
      const path = `couples/${coupleId}/links/${myUid}/${clientId}_${safeFileName(data.file.name)}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, data.file, {
        contentType: data.file.type || 'application/octet-stream',
      })
      fileUrl = await getDownloadURL(storageRef)
      fileName = data.file.name || 'shortcut'
    }
    await addDoc(collection(db, 'couples', coupleId, 'links'), {
      title: data.title.trim(),
      url: data.url.trim(),
      summary: data.summary?.trim() || null,
      fileUrl,
      fileName,
      createdBy: myUid,
      createdAt: serverTimestamp(),
    })
  }, [coupleId, myUid])

  const addRecipe = useCallback(async (data: AddRecipeData) => {
    if (!coupleId || !myUid || !data.date || !data.food.trim()) return
    await addDoc(collection(db, 'couples', coupleId, 'dateRecipes'), {
      date: data.date,
      food: data.food.trim(),
      memo: data.memo?.trim() || null,
      createdBy: myUid,
      createdAt: serverTimestamp(),
    })
  }, [coupleId, myUid])

  return { files, links, recipes, addLink, addRecipe }
}
