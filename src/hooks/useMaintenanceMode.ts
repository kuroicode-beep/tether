// src/hooks/useMaintenanceMode.ts
// 서비스 점검 모드 — adminConfig/maintenance 문서를 실시간으로 구독한다.
// 관리자가 켜면 다른 사용자는 앱에 들어오지 못하고 점검 공지 화면만 보게 된다.
import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

// 점검 상태를 담는 단일 문서 경로
const MAINTENANCE_DOC = ['adminConfig', 'maintenance'] as const

export interface MaintenanceState {
  enabled: boolean
  message: string
  // 문서를 아직 못 읽은 동안은 true — 이때는 화면을 막지 않는다
  loading: boolean
}

const DEFAULT_MESSAGE = '더 나은 서비스를 위해 점검 중이에요.\n잠시 뒤에 다시 찾아와 주세요.'

// 점검 상태를 구독한다 (읽기 실패 시에는 서비스를 막지 않는 쪽으로 둔다)
export function useMaintenanceMode(): MaintenanceState {
  const [state, setState] = useState<MaintenanceState>({
    enabled: false,
    message: DEFAULT_MESSAGE,
    loading: true,
  })

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, ...MAINTENANCE_DOC),
      (snap) => {
        const data = snap.data()
        setState({
          enabled: data?.enabled === true,
          message: typeof data?.message === 'string' && data.message.length > 0
            ? data.message
            : DEFAULT_MESSAGE,
          loading: false,
        })
      },
      (err) => {
        // 점검 문서를 못 읽는다고 정상 사용자를 잠그면 안 된다
        console.warn('[maintenance] 상태를 읽지 못했습니다', err)
        setState({ enabled: false, message: DEFAULT_MESSAGE, loading: false })
      },
    )
    return unsubscribe
  }, [])

  return state
}

// 관리자용 — 점검 모드를 켜고 끈다
export function useMaintenanceControl() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setMaintenance = useCallback(async (enabled: boolean, message?: string) => {
    setSaving(true)
    setError('')
    try {
      await setDoc(
        doc(db, ...MAINTENANCE_DOC),
        {
          enabled,
          message: message ?? DEFAULT_MESSAGE,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      return true
    } catch (err) {
      console.warn('[maintenance] 상태를 바꾸지 못했습니다', err)
      setError('점검 상태를 저장하지 못했어요.')
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  return { setMaintenance, saving, error, defaultMessage: DEFAULT_MESSAGE }
}
