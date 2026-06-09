// src/App.tsx
// 앱 루트: Auth/AppContext 제공 + 화면 라우팅 + Auth↔AppContext 동기화
import { useState, useEffect, useCallback, useRef } from 'react'
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
import { StatusHistoryScreen } from './screens/StatusHistoryScreen'
import { IOSInstallBanner } from './components/IOSInstallBanner'
import { usePushNotification } from './hooks/usePushNotification'
import {
  playNotificationSound,
  shouldAlertForType,
  showSystemNotification,
  SW_PLAY_SOUND_MESSAGE,
} from './lib/notificationAlert'
import { debugLog } from './lib/debugLog'
import { useTheme } from './hooks/useTheme'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useCoupleSession } from './hooks/useCoupleSession'
import { UnreadBadgesProvider } from './context/UnreadBadgesContext'

type Screen =
  | 'lock' | 'onboarding' | 'home' | 'chat' | 'diary' | 'contents'
  | 'settings' | 'photo' | 'history' | 'anniversary' | 'statusHistory'

function AppContent() {
  const { isConnected, uid: appUid, coupleId: appCoupleId, connect, disconnect, syncWithAuthUid } = useApp()
  const { user, coupleId, connection, isLoading, redirecting } = useAuth()
  useTheme()
  const [screen, setScreen] = useState<Screen>('lock')
  const [unlocked, setUnlocked] = useState(false)
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const push = usePushNotification(appUid)
  const pushSyncedRef = useRef<string | null>(null)

  // 알림 허용 시 FCM 토큰 동기화 (로그인 + PWA 복귀 시)
  useEffect(() => {
    if (!appUid || isLoading) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const sync = () => {
      pushSyncedRef.current = appUid
      void push.syncToken()
    }

    sync()

    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [appUid, isLoading, push])

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[App] isLoading:', isLoading, 'user:', user?.uid, 'coupleId:', coupleId)
    }
  }, [isLoading, user?.uid, coupleId])

  const navigate = useCallback((target: string) => {
    if (target === 'more') setScreen('settings')
    else setScreen(target as Screen)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const target = params.get('screen')
    if (target && unlocked && target !== 'lock') {
      setScreen(target as Screen)
    }
  }, [unlocked])

  // 백그라운드 SW가 보낸 차임 재생 요청 (앱이 살아 있을 때)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type !== SW_PLAY_SOUND_MESSAGE) return
      const type = (event.data?.alertType as string) ?? undefined
      if (!shouldAlertForType(type, push.loadSettings())) return
      playNotificationSound()
    }

    navigator.serviceWorker.addEventListener('message', onSwMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage)
  }, [push])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    push.onForegroundMessage((payload) => {
      const data = payload.data ?? {}
      const title = payload.notification?.title ?? data.title ?? 'Tether'
      const body = payload.notification?.body ?? data.body ?? ''
      const type = (data.type as string) ?? undefined
      const settings = push.loadSettings()

      const willAlert = shouldAlertForType(type, settings)
      // #region agent log
      debugLog('App.tsx:onForegroundMessage', 'received', { type: type ?? 'none', willAlert }, 'H4')
      // #endregion
      if (willAlert) {
        playNotificationSound()
        showSystemNotification(title, body, type ?? 'tether-fg')
      }

      setToast({ title, body, type })
    }).then((unsub) => { unsubscribe = unsub })
    return () => unsubscribe?.()
  }, [appUid])

  // 인증 사용자의 uid가 바뀌면 AppContext의 stale 상태를 즉시 정리한다
  useEffect(() => {
    if (isLoading) return
    syncWithAuthUid(user?.uid ?? null)
  }, [user?.uid, isLoading, syncWithAuthUid])

  // 로그아웃되면 AppContext도 깨끗이 비운다
  useEffect(() => {
    if (isLoading) return
    if (!user && (appUid || appCoupleId)) {
      disconnect()
    }
  }, [user, isLoading, appUid, appCoupleId, disconnect])

  // Auth coupleId와 AppContext 캐시가 어긋나면 stale 데이터 구독을 막는다
  useEffect(() => {
    if (isLoading) return
    if (coupleId === null && appCoupleId) {
      disconnect()
      return
    }
    if (coupleId && appCoupleId && coupleId !== appCoupleId) {
      disconnect()
    }
  }, [isLoading, coupleId, appCoupleId, disconnect])

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

  if (isLoading) {
    return (
      <div className="screen min-h-screen flex flex-col items-center justify-center gap-md" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <div className="w-12 h-12 rounded-full border-4 animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
        <p className="font-body-md text-body-md" style={{ color: 'var(--color-text-muted)' }}>
          {redirecting ? 'Google 로그인을 마무리하고 있어요' : '로그인 정보를 확인하고 있어요'}
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

      <div key={screen} className="app-screen-slot">
        {screen === 'onboarding'  && <OnboardingScreen onConnected={() => setScreen('home')} />}
        {screen === 'chat'        && <ChatScreen onBack={toHome} />}
        {screen === 'diary'       && <DiaryScreen onNavigate={navigate} />}
        {screen === 'contents'    && <ContentsScreen onNavigate={navigate} />}
        {screen === 'photo'       && <PhotoAlbum onBack={toHome} />}
        {screen === 'history'     && <HistoryScreen onBack={toHome} />}
        {screen === 'anniversary' && <AnniversaryScreen onBack={toHome} />}
        {screen === 'statusHistory' && <StatusHistoryScreen onBack={toHome} />}
        {screen === 'settings'    && (
          <SettingsScreen
            onBack={toHome}
            onChangePin={handleChangePin}
            onDisconnect={handleDisconnect}
            onOpenAnniversary={() => setScreen('anniversary')}
          />
        )}
        {screen === 'home' && <HomeScreen onNavigate={navigate} />}
      </div>
    </>
  )
}

function AppWithBadges() {
  const { uid, coupleId } = useCoupleSession()
  return (
    <UnreadBadgesProvider coupleId={coupleId} uid={uid}>
      <AppContent />
    </UnreadBadgesProvider>
  )
}

export default function App() {
  return (
    <div className="app-container">
      <AuthProvider>
        <AppProvider>
          <AppWithBadges />
        </AppProvider>
      </AuthProvider>
    </div>
  )
}
