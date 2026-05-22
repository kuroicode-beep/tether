import { useState, useEffect, useCallback } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { LockScreen } from './screens/LockScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ChatScreen } from './screens/ChatScreen'
import { DiaryScreen } from './screens/DiaryScreen'
import { ContentsScreen } from './screens/ContentsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { ToastNotification, ToastPayload } from './components/ToastNotification'
import { usePushNotification } from './hooks/usePushNotification'

type Screen = 'lock' | 'onboarding' | 'home' | 'chat' | 'diary' | 'contents' | 'settings'

function AppContent() {
  const { isConnected, uid } = useApp()
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
    }).then((unsub) => {
      unsubscribe = unsub
    })

    return () => unsubscribe?.()
  }, [uid]) // uid가 바뀌면(로그인) 재등록

  // 잠금 해제 시 연결 여부에 따라 라우팅
  const handleUnlocked = () => {
    setUnlocked(true)
    setScreen(isConnected ? 'home' : 'onboarding')
  }

  // PIN 변경: 잠금 해제 상태 초기화 → LockScreen이 PIN 재설정 모드로 진입
  const handleChangePin = () => {
    setUnlocked(false)
    setScreen('lock')
  }

  // 연결 해제: onboarding으로
  const handleDisconnect = () => {
    setScreen('onboarding')
  }

  if (!unlocked || screen === 'lock') {
    return <LockScreen onUnlocked={handleUnlocked} />
  }

  return (
    <>
      {/* 포그라운드 토스트 */}
      <ToastNotification
        toast={toast}
        onNavigate={navigate}
        onDismiss={() => setToast(null)}
      />

      {screen === 'onboarding' && (
        <OnboardingScreen onConnected={() => setScreen('home')} />
      )}
      {screen === 'chat' && (
        <ChatScreen onBack={() => setScreen('home')} />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          onBack={() => setScreen('home')}
          onChangePin={handleChangePin}
          onDisconnect={handleDisconnect}
        />
      )}
      {screen === 'diary' && (
        <DiaryScreen onNavigate={navigate} />
      )}
      {screen === 'contents' && (
        <ContentsScreen onNavigate={navigate} />
      )}
      {(screen === 'home' || !['onboarding', 'chat', 'settings', 'diary', 'contents'].includes(screen)) && (
        <HomeScreen onNavigate={navigate} />
      )}
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
