import { createContext, useContext, useState, ReactNode } from 'react'

interface AppState {
  uid: string | null
  coupleId: string | null
  myNickname: string
  partnerNickname: string
  partnerUid: string | null
  isConnected: boolean
}

interface AppContextType extends AppState {
  connect: (data: {
    uid: string
    coupleId: string
    myNickname: string
    partnerNickname: string
    partnerUid: string
  }) => void
  disconnect: () => void
}

const LS_KEY = 'tether_app_state'

function loadState(): AppState {
  try {
    const stored = localStorage.getItem(LS_KEY)
    if (stored) {
      const p = JSON.parse(stored) as AppState
      return { ...p, isConnected: !!p.coupleId }
    }
  } catch { /* ignore */ }
  return { uid: null, coupleId: null, myNickname: '', partnerNickname: '', partnerUid: null, isConnected: false }
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState)

  const connect = (data: { uid: string; coupleId: string; myNickname: string; partnerNickname: string; partnerUid: string }) => {
    const next: AppState = { ...data, isConnected: true }
    setState(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  }

  const disconnect = () => {
    const empty: AppState = { uid: null, coupleId: null, myNickname: '', partnerNickname: '', partnerUid: null, isConnected: false }
    setState(empty)
    localStorage.removeItem(LS_KEY)
  }

  return (
    <AppContext.Provider value={{ ...state, connect, disconnect }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
