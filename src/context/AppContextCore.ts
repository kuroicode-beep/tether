import { createContext } from 'react'

export interface AppState {
  uid: string | null
  coupleId: string | null
  myNickname: string
  partnerNickname: string
  partnerUid: string | null
  myPhotoUrl: string | null
  partnerPhotoUrl: string | null
  isConnected: boolean
  startDate: string | null
}

export interface ConnectInput {
  uid: string
  coupleId: string
  myNickname: string
  partnerNickname: string
  partnerUid: string
  startDate?: string
  myPhotoUrl?: string | null
  partnerPhotoUrl?: string | null
}

export interface AppContextType extends AppState {
  connect: (data: ConnectInput) => void
  disconnect: () => void
  syncWithAuthUid: (currentAuthUid: string | null) => void
  setStartDate: (date: string) => void
  setMyNickname: (name: string) => void
  setPartnerNickname: (name: string) => void
  setMyPhotoUrl: (url: string | null) => void
}

export const AppContext = createContext<AppContextType | null>(null)
