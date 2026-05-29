import { useState, useEffect } from 'react'
import {
  collection, addDoc, onSnapshot, doc,
  updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'

export interface Photo {
  id: string
  uploadedBy: string
  imageUrl: string
  caption: string | null
  createdAt: number | null
}

function toPhoto(data: Record<string, unknown>, id: string): Photo {
  const ts = data['createdAt'] as Timestamp | null
  return {
    id,
    uploadedBy: (data['uploadedBy'] as string) ?? '',
    imageUrl: (data['imageUrl'] as string) ?? '',
    caption: (data['caption'] as string | null) ?? null,
    createdAt: ts?.toMillis() ?? null,
  }
}

export function usePhotos(coupleId: string | null, myUid: string | null) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!coupleId) {
      setPhotos([])
      return
    }

    const q = query(
      collection(db, 'couples', coupleId, 'photos'),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(q, (snap) => {
      setPhotos(snap.docs.map((d) => toPhoto(d.data() as Record<string, unknown>, d.id)))
    })
    return () => unsub()
  }, [coupleId])

  const uploadPhoto = async (file: File, caption?: string) => {
    if (!coupleId || !myUid) return
    setUploading(true)

    const localUrl = URL.createObjectURL(file)
    const optimistic: Photo = {
      id: `opt_${Date.now()}`,
      uploadedBy: myUid,
      imageUrl: localUrl,
      caption: caption ?? null,
      createdAt: Date.now(),
    }
    setPhotos((prev) => [optimistic, ...prev])

    try {
      const path = `couples/${coupleId}/photos/${Date.now()}_${file.name}`
      await uploadBytes(ref(storage, path), file)
      const imageUrl = await getDownloadURL(ref(storage, path))
      await addDoc(collection(db, 'couples', coupleId, 'photos'), {
        uploadedBy: myUid,
        imageUrl,
        caption: caption ?? null,
        createdAt: serverTimestamp(),
      })
    } catch { /* ignore */ }

    setUploading(false)
  }

  const updatePhoto = async (photoId: string, caption: string | null) => {
    if (!coupleId || photoId.startsWith('opt_')) return
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'photos', photoId), { caption })
    } catch { /* ignore */ }
  }

  const deletePhoto = async (photoId: string) => {
    if (!coupleId || photoId.startsWith('opt_')) return
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'photos', photoId))
    } catch { /* ignore */ }
  }

  return { photos, uploading, uploadPhoto, updatePhoto, deletePhoto }
}
