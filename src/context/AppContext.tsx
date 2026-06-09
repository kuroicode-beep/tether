// src/context/AppContext.tsx
// 앱 전역 상태 (uid, coupleId, 닉네임 등) — Auth 변경 시 stale 상태를 자동 정리한다
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'

interface AppState {
  uid: string | null
  coupleId: string | null
  myNickname: string
  partnerNickname: string
  partnerUid: string | null
  isConnected: boolean
  startDate: string | null   // ISO 날짜 문자열 (처음 만난 날, YYYY-MM-DD)
}

interface ConnectInput {
  uid: string
  coupleId: string
  myNickname: string
  partnerNickname: string
  partnerUid: string
  startDate?: string
}

interface AppContextType extends AppState {
  connect: (data: ConnectInput) => void
  disconnect: () => void
  syncWithAuthUid: (currentAuthUid: string | null) => void
  setStartDate: (date: string) => void
  setMyNickname: (name: string) => void
  setPartnerNickname: (name: string) => void
}

const LS_KEY = 'tether_app_state'

const EMPTY_STATE: AppState = {
  uid: null,
  coupleId: null,
  myNickname: '',
  partnerNickname: '',
  partnerUid: null,
  isConnected: false,
  startDate: null,
}

// localStorage에서 UI 캐시만 복원 — coupleId/uid는 Session이 source of truth
function loadState(): AppState {
  try {
    const stored = localStorage.getItem(LS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppState>
      return {
        uid: null,
        coupleId: null,
        partnerUid: null,
        isConnected: false,
        myNickname: parsed.myNickname ?? '',
        partnerNickname: parsed.partnerNickname ?? '',
        startDate: parsed.startDate ?? null,
      }
    }
  } catch { /* ignore */ }
  return EMPTY_STATE
}

// 상태를 localStorage에 캐시한다 — coupleId 없으면 닉네임/날짜만 보존
function persistState(next: AppState) {
  try {
    if (!next.coupleId) {
      if (next.myNickname || next.partnerNickname || next.startDate) {
        localStorage.setItem(LS_KEY, JSON.stringify({
          myNickname: next.myNickname,
          partnerNickname: next.partnerNickname,
          startDate: next.startDate,
        }))
      } else {
        localStorage.removeItem(LS_KEY)
      }
      return
    }
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch { /* ignore */ }
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState)

  const writeState = useCallback((next: AppState) => {
    setState(next)
    persistState(next)
  }, [])

  // 새 커플 정보를 등록한다 — 옛 startDate를 보존한다 (uid 일치 시에만)
  const connect = useCallback((data: ConnectInput) => {
    setState((prev) => {
      const sameCouple = !prev.coupleId || prev.coupleId === data.coupleId
      const keepStartDate = prev.uid === data.uid && prev.startDate
        ? prev.startDate
        : data.startDate ?? new Date().toISOString().split('T')[0]
      const next: AppState = {
        ...data,
        myNickname: sameCouple && prev.myNickname ? prev.myNickname : data.myNickname,
        partnerNickname: sameCouple && prev.partnerNickname ? prev.partnerNickname : data.partnerNickname,
        isConnected: true,
        startDate: data.startDate ?? keepStartDate,
      }
      persistState(next)
      return next
    })
  }, [])

  const disconnect = useCallback(() => {
    writeState({ ...EMPTY_STATE })
  }, [writeState])

  // 현재 인증된 사용자의 uid가 저장된 uid와 다르면 옛 상태를 폐기한다
  const syncWithAuthUid = useCallback((currentAuthUid: string | null) => {
    setState((prev) => {
      if (!prev.uid) return prev
      if (currentAuthUid && currentAuthUid === prev.uid) return prev

      const next = { ...EMPTY_STATE }
      persistState(next)
      return next
    })
  }, [])

  const setStartDate = useCallback((date: string) => {
    setState((prev) => {
      const next = { ...prev, startDate: date }
      persistState(next)
      return next
    })
  }, [])

  const setMyNickname = useCallback((name: string) => {
    setState((prev) => {
      const next = { ...prev, myNickname: name }
      persistState(next)
      return next
    })
  }, [])

  const setPartnerNickname = useCallback((name: string) => {
    setState((prev) => {
      const next = { ...prev, partnerNickname: name }
      persistState(next)
      return next
    })
  }, [])

  // 다른 탭/창에서 발생한 storage 이벤트를 수신해 상태를 동기화한다
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key !== LS_KEY) return
      try {
        if (!event.newValue) {
          setState({ ...EMPTY_STATE })
          return
        }
        const parsed = JSON.parse(event.newValue) as Partial<AppState>
        setState({
          uid: null,
          coupleId: null,
          myNickname: parsed.myNickname ?? '',
          partnerNickname: parsed.partnerNickname ?? '',
          partnerUid: null,
          isConnected: false,
          startDate: parsed.startDate ?? null,
        })
      } catch { /* ignore */ }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return (
    <AppContext.Provider value={{
      ...state,
      connect,
      disconnect,
      syncWithAuthUid,
      setStartDate,
      setMyNickname,
      setPartnerNickname,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
