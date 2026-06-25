// src/hooks/useFeedbackReports.ts
// Log 화면의 기능개선/버그 리포트를 커플 공유 Firestore 데이터로 동기화한다.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { createClientId, createOptimisticId } from '../lib/clientId'
import { isOptimisticId, mergeByCreatedAtDesc, readClientId, reconcilePending } from '../lib/syncHelpers'

export type FeedbackReportType = 'improvement' | 'bug'
export type FeedbackReportStatus = 'open' | 'done'

export interface FeedbackReport {
  id: string
  clientId?: string
  type: FeedbackReportType
  text: string
  status: FeedbackReportStatus
  authorUid: string
  authorNickname: string
  createdAt: number | null
  updatedAt?: number | null
  doneAt?: number | null
  doneBy?: string | null
  pending?: boolean
}

interface AddReportOptions {
  clientId?: string
  createdAt?: number
}

function readMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null
}

function toFeedbackReport(data: Record<string, unknown>, id: string): FeedbackReport {
  return {
    id,
    clientId: readClientId(data),
    type: data.type === 'bug' ? 'bug' : 'improvement',
    text: typeof data.text === 'string' ? data.text : '',
    status: data.status === 'done' ? 'done' : 'open',
    authorUid: typeof data.authorUid === 'string' ? data.authorUid : '',
    authorNickname: typeof data.authorNickname === 'string' ? data.authorNickname : '익명',
    createdAt: readMillis(data.createdAt),
    updatedAt: readMillis(data.updatedAt),
    doneAt: readMillis(data.doneAt),
    doneBy: typeof data.doneBy === 'string' ? data.doneBy : null,
  }
}

export function useFeedbackReports(
  coupleId: string | null,
  uid: string | null,
  nickname: string,
) {
  const [reports, setReports] = useState<FeedbackReport[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef(new Map<string, FeedbackReport>())

  useEffect(() => {
    if (!coupleId || !uid) {
      pendingRef.current.clear()
      setReports([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const q = query(
      collection(db, 'couples', coupleId, 'feedbackReports'),
      orderBy('createdAt', 'desc'),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const server = snap.docs.map((item) => (
          toFeedbackReport(item.data() as Record<string, unknown>, item.id)
        ))
        reconcilePending(
          pendingRef.current,
          server,
          (pending, item) =>
            pending.authorUid === item.authorUid
            && pending.text === item.text
            && pending.type === item.type
            && pending.createdAt != null
            && item.createdAt != null
            && Math.abs(pending.createdAt - item.createdAt) < 120_000,
          (item) => item.clientId,
        )
        setReports(mergeByCreatedAtDesc(server, [...pendingRef.current.values()]))
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.warn('[useFeedbackReports] listener error', err)
        setReports([...pendingRef.current.values()])
        setLoading(false)
        setError('리포트를 불러오지 못했어요. 잠시 후 다시 시도해주세요.')
      },
    )

    return () => unsub()
  }, [coupleId, uid])

  const addReport = useCallback(async (
    type: FeedbackReportType,
    rawText: string,
    options?: AddReportOptions,
  ) => {
    const text = rawText.trim()
    if (!coupleId || !uid || !text) return false

    const clientId = options?.clientId ?? createClientId('feedback')
    const optimistic: FeedbackReport = {
      id: createOptimisticId(clientId),
      clientId,
      type,
      text,
      status: 'open',
      authorUid: uid,
      authorNickname: nickname.trim() || '나',
      createdAt: options?.createdAt ?? Date.now(),
      pending: true,
    }

    pendingRef.current.set(optimistic.id, optimistic)
    setReports((prev) => mergeByCreatedAtDesc(prev.filter((item) => item.id !== optimistic.id), [optimistic]))
    setSaving(true)
    setError(null)

    try {
      await setDoc(doc(db, 'couples', coupleId, 'feedbackReports', clientId), {
        clientId,
        type,
        text,
        status: 'open',
        authorUid: uid,
        authorNickname: nickname.trim() || '나',
        createdAt: options?.createdAt ? Timestamp.fromMillis(options.createdAt) : serverTimestamp(),
      })
      return true
    } catch (err) {
      console.warn('[useFeedbackReports] add failed', err)
      pendingRef.current.delete(optimistic.id)
      setReports((prev) => prev.filter((item) => item.id !== optimistic.id))
      setError('리포트를 저장하지 못했어요. 네트워크를 확인한 뒤 다시 시도해주세요.')
      return false
    } finally {
      setSaving(false)
    }
  }, [coupleId, uid, nickname])

  const deleteReport = useCallback(async (reportId: string) => {
    if (!coupleId || isOptimisticId(reportId)) return false
    setError(null)
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'feedbackReports', reportId))
      return true
    } catch (err) {
      console.warn('[useFeedbackReports] delete failed', err)
      setError('리포트를 삭제하지 못했어요. 작성자만 삭제할 수 있어요.')
      return false
    }
  }, [coupleId])

  const toggleReportStatus = useCallback(async (report: FeedbackReport) => {
    if (!coupleId || !uid || isOptimisticId(report.id)) return false
    const nextStatus: FeedbackReportStatus = report.status === 'done' ? 'open' : 'done'
    const previous = report
    setReports((prev) => prev.map((item) => (
      item.id === report.id
        ? {
            ...item,
            status: nextStatus,
            doneAt: nextStatus === 'done' ? Date.now() : null,
            doneBy: nextStatus === 'done' ? uid : null,
          }
        : item
    )))
    setError(null)

    try {
      await updateDoc(doc(db, 'couples', coupleId, 'feedbackReports', report.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        doneAt: nextStatus === 'done' ? serverTimestamp() : null,
        doneBy: nextStatus === 'done' ? uid : null,
      })
      return true
    } catch (err) {
      console.warn('[useFeedbackReports] status update failed', err)
      setReports((prev) => prev.map((item) => (item.id === report.id ? previous : item)))
      setError('리포트 상태를 바꾸지 못했어요. 잠시 후 다시 시도해주세요.')
      return false
    }
  }, [coupleId, uid])

  return {
    reports,
    loading,
    saving,
    error,
    addReport,
    deleteReport,
    toggleReportStatus,
    clearError: () => setError(null),
  }
}
