// src/App.tsx
// 앱 루트: Auth/AppContext 제공 + 화면 라우팅 + Auth↔AppContext 동기화
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
import { AuthProvider, useAuth } from './hooks/useAuth'

type Screen =
  | 'lock' | 'onboarding' | 'home' | 'chat' | 'diary' | 'contents'
  | 'settings' | 'photo' | 'history' | 'anniversary'

function AppContent() {
  const { isConnected, uid: appUid, coupleId: appCoupleId, connect, disconnect, syncWithAuthUid } = useApp()
  const { user, coupleId, connection, loading: authLoading } = useAuth()
  useTheme()
  const [screen, setScreen] = useState<Screen>('lock')
  const [unlocked, setUnlocked] = useState(false)
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const push = usePushNotification(appUid)

  const navigate = useCallback((target: string) => {
    if (target === 'more') setScreen('settings')
    else setScreen(target as Screen)
  }, [])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    push.onForegroundMessage((payload) => {
      const title = payload.notification?.title ?? 'Tether'
      const body = payload.notification?.body ?? ''
      const type = (payload.data?.type as string) ?? undefined
      setToast({ title, body, type })
    }).then((unsub) => { unsubscribe = unsub })
    return () => unsubscribe?.()
  }, [appUid])

  // 인증 사용자의 uid가 바뀌면 AppContext의 stale 상태를 즉시 정리한다
  useEffect(() => {
    if (authLoading) return
    syncWithAuthUid(user?.uid ?? null)
  }, [user?.uid, authLoading, syncWithAuthUid])

  // 로그아웃되면 AppContext도 깨끗이 비운다
  useEffect(() => {
    if (authLoading) return
    if (!user && (appUid || appCoupleId)) {
      disconnect()
    }
  }, [user, authLoading, appUid, appCoupleId, disconnect])

  // useAuth가 복원한 connection을 AppContext에 반영하고, 잠금이 풀린 상태면 홈으로 보낸다
  useEffect(() => {
    if (!connection) return
    if (isConnected && appUid === connection.uid && appCoupleId === connection.coupleId) return
    connect(connection)
    if (unlocked) setScreen('home')
  }, [connection, isConnected, appUid, appCoupleId, unlocked, connect])

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

  const showSpinner = authLoading || coupleId === undefined

  if (showSpinner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-md" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <div className="w-12 h-12 rounded-full border-4 animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
        <p className="font-body-md text-body-md" style={{ color: 'var(--color-text-muted)' }}>
          로그인 정보를 확인하고 있어요
        </p>
      </div>
    )
  }

  if (!user) {
    return <OnboardingScreen onConnected={() => { setUnlocked(false); setScreen('lock') }} />
  }

  if (coupleId === null) {
    return <OnboardingScreen onConnected={() => { setUnlocked(false); setScreen('lock') }} />
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
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  )
}
