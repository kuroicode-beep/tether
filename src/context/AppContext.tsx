import { createContext, useContext, useState, ReactNode } from 'react'

interface AppState {
  uid: string | null
  coupleId: string | null
  myNickname: string
  partnerNickname: string
  partnerUid: string | null
  isConnected: boolean
  startDate: string | null   // ISO 날짜 문자열 (처음 만난 날, YYYY-MM-DD)
}

interface AppContextType extends AppState {
  connect: (data: {
    uid: string
    coupleId: string
    myNickname: string
    partnerNickname: string
    partnerUid: string
    startDate?: string
  }) => void
  disconnect: () => void
  setStartDate: (date: string) => void
}

const LS_KEY = 'tether_app_state'

function loadState(): AppState {
  try {
    const stored = localStorage.getItem(LS_KEY)
    if (stored) {
      const p = JSON.parse(stored) as AppState
      return { ...p, isConnected: !!p.coupleId, startDate: p.startDate ?? null }
    }
  } catch { /* ignore */ }
  return {
    uid: null, coupleId: null, myNickname: '', partnerNickname: '',
    partnerUid: null, isConnected: false, startDate: null,
  }
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState)

  const connect = (data: {
    uid: string
    coupleId: string
    myNickname: string
    partnerNickname: string
    partnerUid: string
    startDate?: string
  }) => {
    const next: AppState = {
      ...data,
      isConnected: true,
      startDate: data.startDate ?? state.startDate ?? new Date().toISOString().split('T')[0],
    }
    setState(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  }

  const disconnect = () => {
    const empty: AppState = {
      uid: null, coupleId: null, myNickname: '', partnerNickname: '',
      partnerUid: null, isConnected: false, startDate: null,
    }
    setState(empty)
    localStorage.removeItem(LS_KEY)
  }

  const setStartDate = (date: string) => {
    const next = { ...state, startDate: date }
    setState(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  }

  return (
    <AppContext.Provider value={{ ...state, connect, disconnect, setStartDate }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
