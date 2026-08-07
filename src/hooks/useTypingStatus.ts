// src/hooks/useTypingStatus.ts
// 상대방 "입력 중" 표시 — couples/{coupleId}/typing/{uid} 문서로 상태를 주고받는다.
import { useState, useEffect, useRef, useCallback } from 'react'
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

// 이 시간 안에 갱신이 없으면 입력이 멈춘 것으로 본다
const TYPING_TTL_MS = 6000
// 입력 중 상태를 다시 써주는 최소 간격 (Firestore 쓰기 절약)
const WRITE_INTERVAL_MS = 2500

export function useTypingStatus(
  coupleId: string | null,
  myUid: string | null,
  partnerUid: string | null | undefined,
) {
  const [partnerTyping, setPartnerTyping] = useState(false)
  const lastWriteAtRef = useRef(0)
  const hideTimerRef = useRef<number | null>(null)
  const activeRef = useRef(false)

  // 상대방 typing 문서를 구독해 TTL 안쪽이면 표시한다
  useEffect(() => {
    if (!coupleId || !partnerUid) {
      setPartnerTyping(false)
      return
    }
    const ref = doc(db, 'couples', coupleId, 'typing', partnerUid)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (hideTimerRef.current != null) {
          window.clearTimeout(hideTimerRef.current)
          hideTimerRef.current = null
        }
        const at = (snap.data()?.['at'] as Timestamp | null | undefined)?.toMillis() ?? null
        const age = at != null ? Date.now() - at : Number.POSITIVE_INFINITY
        if (!snap.exists() || age >= TYPING_TTL_MS) {
          setPartnerTyping(false)
          return
        }
        setPartnerTyping(true)
        hideTimerRef.current = window.setTimeout(
          () => setPartnerTyping(false),
          TYPING_TTL_MS - age,
        )
      },
      (err) => {
        console.warn('[useTypingStatus] listener error', err)
        setPartnerTyping(false)
      },
    )
    return () => {
      unsub()
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }
  }, [coupleId, partnerUid])

  // 내가 입력 중임을 알린다 (간격 제한을 두고 갱신)
  const notifyTyping = useCallback(() => {
    if (!coupleId || !myUid) return
    const now = Date.now()
    if (now - lastWriteAtRef.current < WRITE_INTERVAL_MS) return
    lastWriteAtRef.current = now
    activeRef.current = true
    setDoc(doc(db, 'couples', coupleId, 'typing', myUid), {
      uid: myUid,
      at: serverTimestamp(),
    }).catch((err) => console.warn('[useTypingStatus] notify failed', err))
  }, [coupleId, myUid])

  // 입력을 멈췄음을 알린다 (전송·입력창 비움·화면 이탈)
  const stopTyping = useCallback(() => {
    if (!coupleId || !myUid || !activeRef.current) return
    activeRef.current = false
    lastWriteAtRef.current = 0
    deleteDoc(doc(db, 'couples', coupleId, 'typing', myUid))
      .catch((err) => console.warn('[useTypingStatus] stop failed', err))
  }, [coupleId, myUid])

  // 화면을 떠나면 입력 중 상태를 정리한다
  useEffect(() => stopTyping, [stopTyping])

  return { partnerTyping, notifyTyping, stopTyping }
}
