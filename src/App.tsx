import { useState, useEffect, useCallback } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { LockScreen } from './screens/LockScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ChatScreen } from './screens/ChatScreen'
import { DiaryScreen } from './screens/DiaryScreen'
import { ContentsScreen } from './screens/ContentsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { PhotoAlbum } from './screens/PhotoAlbum'
import { HistoryScreen } from './screens/HistoryScreen'
import { AnniversaryScreen } from './screens/AnniversaryScreen'
import { ToastNotification, ToastPayload } from './components/ToastNotification'
import { IOSInstallBanner } from './components/IOSInstallBanner'
import { usePushNotification } from './hooks/usePushNotification'
import { useTheme } from './hooks/useTheme'

type Screen =
  | 'lock' | 'onboarding' | 'home' | 'chat' | 'diary' | 'contents'
  | 'settings' | 'photo' | 'history' | 'anniversary'

function AppContent() {
  const { isConnected, uid } = useApp()
  useTheme()   // 앱 루트에서 data-theme 적용 (localStorage → document.documentElement)
  const [screen, setScreen] = useState<Screen>('lock')
  const [unlocked, setUnlocked] = useState(false)
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const push = usePushNotification(uid)

  const navigate = useCallback((target: string) => {
    if (target === 'more') setScreen('settings')
    else setScreen(target as Screen)
  }, [])

  // 포그라운드 FCM 메시지 수신 등록
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    push.onForegroundMessage((payload) => {
      const title = payload.notification?.title ?? 'Tether'
      const body = payload.notification?.body ?? ''
      const type = (payload.data?.type as string) ?? undefined
      setToast({ title, body, type })
    }).then((unsub) => { unsubscribe = unsub })
    return () => unsubscribe?.()
  }, [uid])

  const handleUnlocked = () => {
    setUnlocked(true)
    setScreen(isConnected ? 'home' : 'onboarding')
  }

  const handleChangePin = () => {
    setUnlocked(false)
    setScreen('lock')
  }

  const handleDisconnect = () => {
    setScreen('onboarding')
  }

  if (!unlocked || screen === 'lock') {
    return <LockScreen onUnlocked={handleUnlocked} />
  }

  const toHome = () => setScreen('home')

  return (
    <>
      <ToastNotification toast={toast} onNavigate={navigate} onDismiss={() => setToast(null)} />
      <IOSInstallBanner />

      {screen === 'onboarding'  && <OnboardingScreen onConnected={() => setScreen('home')} />}
      {screen === 'chat'        && <ChatScreen onBack={toHome} />}
      {screen === 'diary'       && <DiaryScreen onNavigate={navigate} />}
      {screen === 'contents'    && <ContentsScreen onNavigate={navigate} />}
      {screen === 'photo'       && <PhotoAlbum onBack={toHome} />}
      {screen === 'history'     && <HistoryScreen onBack={toHome} />}
      {screen === 'anniversary' && <AnniversaryScreen onBack={toHome} />}
      {screen === 'settings'    && (
        <SettingsScreen
          onBack={toHome}
          onChangePin={handleChangePin}
          onDisconnect={handleDisconnect}
          onOpenAnniversary={() => setScreen('anniversary')}
        />
      )}
      {screen === 'home' && <HomeScreen onNavigate={navigate} />}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
