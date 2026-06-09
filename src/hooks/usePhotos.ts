import { useState, useEffect, useRef, useCallback } from 'react'
import {
  collection, addDoc, onSnapshot, doc, getDoc,
  updateDoc, deleteDoc,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { createClientId, createOptimisticId } from '../lib/clientId'
import {
  isOptimisticId,
  mergeByCreatedAtDesc,
  readClientId,
  reconcilePending,
  revokeBlobUrl,
} from '../lib/syncHelpers'

export interface Photo {
  id: string
  clientId?: string
  uploadedBy: string
  imageUrl: string
  caption: string | null
  createdAt: number | null
}

function toPhoto(data: Record<string, unknown>, id: string): Photo {
  const ts = data['createdAt'] as Timestamp | null
  return {
    id,
    clientId: readClientId(data),
    uploadedBy: (data['uploadedBy'] as string) ?? '',
    imageUrl: (data['imageUrl'] as string) ?? '',
    caption: (data['caption'] as string | null) ?? null,
    createdAt: ts?.toMillis() ?? null,
  }
}

function sortPhotos(items: Photo[]): Photo[] {
  return [...items].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export function usePhotos(coupleId: string | null, myUid: string | null, partnerUid?: string | null) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef(new Map<string, Photo>())

  const applyServerDocs = useCallback((server: Photo[]) => {
    reconcilePending(pendingRef.current, server, (p, s) =>
      p.uploadedBy === s.uploadedBy
      && (p.caption ?? '') === (s.caption ?? '')
      && p.createdAt != null
      && s.createdAt != null
      && Math.abs(p.createdAt - s.createdAt) < 120_000,
    (s) => s.clientId)
    setPhotos(mergeByCreatedAtDesc(server, [...pendingRef.current.values()]))
  }, [])

  useEffect(() => {
    if (!coupleId || !myUid) {
      pendingRef.current.clear()
      setPhotos([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const verifyMembership = async () => {
      try {
        const coupleSnap = await getDoc(doc(db, 'couples', coupleId))
        if (cancelled) return false
        const members = coupleSnap.data()?.members
        if (!coupleSnap.exists() || !Array.isArray(members) || !members.includes(myUid)) {
          setError('커플 연결 정보를 확인할 수 없어요. 앱을 다시 시작해주세요.')
          setPhotos([])
          setLoading(false)
          return false
        }

        if (partnerUid) {
          const partnerSnap = await getDoc(doc(db, 'users', partnerUid))
          if (cancelled) return false
          const partnerCoupleId = partnerSnap.data()?.coupleId
          if (partnerCoupleId && partnerCoupleId !== coupleId) {
            setError('상대방과 연결 정보가 일치하지 않아요. 설정에서 다시 연결해주세요.')
          }
        }
        return true
      } catch (err) {
        console.warn('[usePhotos] membership check failed', err)
        return true
      }
    }

    let unsub = () => {}

    void verifyMembership().then((ok) => {
      if (cancelled || !ok) return

      unsub = onSnapshot(
        collection(db, 'couples', coupleId, 'photos'),
        (snap) => {
          const server = sortPhotos(
            snap.docs.map((d) => toPhoto(d.data() as Record<string, unknown>, d.id)),
          )
          applyServerDocs(server)
          setLoading(false)
          setError(null)
        },
        (err) => {
          console.warn('[usePhotos] listener error', err)
          setLoading(false)
          setError('사진을 불러오지 못했어요. 네트워크를 확인해주세요.')
        },
      )
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [coupleId, myUid, partnerUid, applyServerDocs])

  const uploadPhoto = async (file: File, caption?: string) => {
    if (!coupleId || !myUid) return
    setUploading(true)
    setError(null)

    const clientId = createClientId('photo')
    const localUrl = URL.createObjectURL(file)
    const optimistic: Photo = {
      id: createOptimisticId(clientId),
      clientId,
      uploadedBy: myUid,
      imageUrl: localUrl,
      caption: caption ?? null,
      createdAt: Date.now(),
    }
    pendingRef.current.set(optimistic.id, optimistic)
    setPhotos((prev) => mergeByCreatedAtDesc(prev.filter((p) => p.id !== optimistic.id), [optimistic]))

    try {
      const safeName = file.name.replace(/[^\w.\-]/g, '_') || 'photo.jpg'
      const storageRef = ref(storage, `couples/${coupleId}/photos/${myUid}/${clientId}_${safeName}`)
      await uploadBytes(storageRef, file, {
        contentType: file.type || 'image/jpeg',
      })
      const imageUrl = await getDownloadURL(storageRef)
      await addDoc(collection(db, 'couples', coupleId, 'photos'), {
        clientId,
        uploadedBy: myUid,
        imageUrl,
        caption: caption ?? null,
        createdAt: Timestamp.now(),
      }).catch(async (err) => {
        await deleteObject(storageRef).catch(() => undefined)
        throw err
      })
    } catch (err) {
      pendingRef.current.delete(optimistic.id)
      revokeBlobUrl(localUrl)
      setPhotos((prev) => prev.filter((p) => p.id !== optimistic.id))
      console.warn('[usePhotos] upload failed', err)
      setError('사진 업로드에 실패했어요. 다시 시도해주세요.')
    } finally {
      setUploading(false)
    }
  }

  const updatePhoto = async (photoId: string, caption: string | null) => {
    if (!coupleId || isOptimisticId(photoId)) return
    let previousCaption: string | null = null
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === photoId)
      previousCaption = photo?.caption ?? null
      return prev.map((p) => (p.id === photoId ? { ...p, caption } : p))
    })
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'photos', photoId), { caption })
    } catch (err) {
      console.warn('[usePhotos] update failed', err)
      const rollback = previousCaption
      setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, caption: rollback } : p)))
      setError('사진 수정에 실패했어요')
    }
  }

  const deletePhoto = async (photoId: string) => {
    if (!coupleId || isOptimisticId(photoId)) return
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'photos', photoId))
    } catch (err) {
      console.warn('[usePhotos] delete failed', err)
      setError('사진 삭제에 실패했어요')
    }
  }

  return {
    photos,
    loading,
    uploading,
    error,
    uploadPhoto,
    updatePhoto,
    deletePhoto,
    clearError: () => setError(null),
  }
}
