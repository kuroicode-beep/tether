// src/hooks/useListeningTogether.ts
// Synchronizes the couple-shared listening playlist and per-user exclusions.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export interface ListenTrack {
  id: string
  title: string
  url: string
  ownerUid: string
}

type ListeningTogetherDoc = {
  selections?: Record<string, ListenTrack[]>
  excludedBy?: Record<string, string | null>
}

function normalizeTracks(value: unknown): ListenTrack[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const data = item as Partial<ListenTrack>
      if (
        typeof data.id !== 'string'
        || typeof data.title !== 'string'
        || typeof data.url !== 'string'
        || typeof data.ownerUid !== 'string'
      ) {
        return null
      }
      return {
        id: data.id,
        title: data.title,
        url: data.url,
        ownerUid: data.ownerUid,
      }
    })
    .filter((item): item is ListenTrack => item !== null)
}

export function useListeningTogether(coupleId: string | null, myUid: string | null, partnerUid?: string | null) {
  const [selections, setSelections] = useState<Record<string, ListenTrack[]>>({})
  const [excludedBy, setExcludedBy] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (!coupleId) {
      setSelections({})
      setExcludedBy({})
      return
    }

    return onSnapshot(
      doc(db, 'couples', coupleId),
      (snap) => {
        const data = snap.data() as ListeningTogetherDoc | undefined
        const rawSelections = data?.selections ?? {}
        const nextSelections: Record<string, ListenTrack[]> = {}
        Object.entries(rawSelections).forEach(([uid, tracks]) => {
          nextSelections[uid] = normalizeTracks(tracks)
        })
        setSelections(nextSelections)
        setExcludedBy(data?.excludedBy ?? {})
      },
      (err) => console.warn('[useListeningTogether] listener failed', err),
    )
  }, [coupleId])

  const myTracks = useMemo(() => (myUid ? selections[myUid] ?? [] : []), [myUid, selections])
  const partnerTracks = useMemo(() => (partnerUid ? selections[partnerUid] ?? [] : []), [partnerUid, selections])

  const activeTracks = useMemo(() => {
    if (!myUid) return []
    const excludedId = excludedBy[myUid]
    return Object.values(selections)
      .flat()
      .filter((track) => track.id !== excludedId)
  }, [excludedBy, myUid, selections])

  const setMyTrackSelected = useCallback(async (track: ListenTrack, selected: boolean) => {
    if (!coupleId || !myUid) return false
    const current = selections[myUid] ?? []
    const exists = current.some((item) => item.id === track.id)
    const next = selected
      ? exists ? current : [...current, track].slice(0, 3)
      : current.filter((item) => item.id !== track.id)
    if (selected && !exists && current.length >= 3) return false

    await setDoc(doc(db, 'couples', coupleId), {
      selections: {
        ...selections,
        [myUid]: next,
      },
      listeningTogetherUpdatedAt: serverTimestamp(),
    }, { merge: true })
    return true
  }, [coupleId, myUid, selections])

  const setExcludedPartnerTrack = useCallback(async (trackId: string | null) => {
    if (!coupleId || !myUid) return
    await setDoc(doc(db, 'couples', coupleId), {
      excludedBy: {
        ...excludedBy,
        [myUid]: trackId,
      },
      listeningTogetherUpdatedAt: serverTimestamp(),
    }, { merge: true })
  }, [coupleId, excludedBy, myUid])

  return {
    selections,
    excludedBy,
    myTracks,
    partnerTracks,
    activeTracks,
    setMyTrackSelected,
    setExcludedPartnerTrack,
  }
}
