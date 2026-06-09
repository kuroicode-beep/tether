// src/App.tsx
// 앱 루트: Session/AppContext 제공 + status 기반 라우팅
import { useState, useEffect, useCallback, useRef } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { SessionProvider, useSession } from './context/SessionContext'
import { LockScreen } from './screens/LockScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { RestoreFailedScreen } from './screens/RestoreFailedScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ChatScreen } from './screens/ChatScreen'
import { DiaryScreen } from './screens/DiaryScreen'
import { ContentsScreen } from './screens/ContentsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { PhotoAlbum } from './screens/PhotoAlbum'
import { AnniversaryScreen } from './screens/AnniversaryScreen'
import { ToastNotification, ToastPayload } from './components/ToastNotification'
import { StatusHistoryScreen } from './screens/StatusHistoryScreen'
import { IOSInstallBanner } from './components/IOSInstallBanner'
import { usePushNotification } from './hooks/usePushNotification'
import {
  playNotificationSound,
  screenFromNotificationUrl,
  shouldAlertForType,
  showSystemNotification,
  SW_NAVIGATE_MESSAGE,
  SW_PLAY_SOUND_MESSAGE,
} from './lib/notificationAlert'
import { debugLog } from './lib/debugLog'
import { useTheme } from './hooks/useTheme'
import { useCoupleSession } from './hooks/useCoupleSession'
import { UnreadBadgesProvider } from './context/UnreadBadgesContext'

type Screen =
  | 'lock' | 'onboarding' | 'home' | 'chat' | 'diary' | 'contents'
  | 'settings' | 'photo' | 'history' | 'anniversary' | 'statusHistory'

const NAVIGATION_SCREENS = new Set<string>([
  'home',
  'chat',
  'diary',
  'contents',
  'settings',
  'photo',
  'history',
  'anniversary',
  'statusHistory',
])

function AppContent() {
  const { connect, disconnect } = useApp()
  const session = useSession()
  useTheme()
  const [screen, setScreen] = useState<Screen>('lock')
  const [unlocked, setUnlocked] = useState(false)
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const push = usePushNotification(session.uid)
  const pushSyncedRef = useRef<string | null>(null)
  const pendingNavRef = useRef<string | null>(null)

  useEffect(() => {
    if (!session.uid || session.isLoading) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const sync = () => {
      pushSyncedRef.current = session.uid!
      void push.syncToken()
    }

    sync()

    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [session.uid, session.isLoading, push])

  const navigate = useCallback((target: string) => {
    if (target === 'more') setScreen('settings')
    else if (NAVIGATION_SCREENS.has(target)) setScreen(target as Screen)
  }, [])

  const requestNavigation = useCallback((target: string | null | undefined) => {
    if (!target || !NAVIGATION_SCREENS.has(target)) return
    if (!unlocked) {
      pendingNavRef.current = target
      return
    }
    navigate(target)
  }, [unlocked, navigate])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const target = params.get('screen')
    if (target) requestNavigation(target)
  }, [unlocked, requestNavigation])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const onSwMessage = (event: MessageEvent) => {
      const data = event.data ?? {}
      if (data.type === SW_NAVIGATE_MESSAGE) {
        requestNavigation(data.screen as string | undefined)
        return
      }
      if (data.type !== SW_PLAY_SOUND_MESSAGE) return
      const type = (data.alertType as string) ?? undefined
      if (!shouldAlertForType(type, push.loadSettings())) return
      playNotificationSound()
    }

    navigator.serviceWorker.addEventListener('message', onSwMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage)
  }, [push, requestNavigation])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    push.onForegroundMessage((payload) => {
      const data = payload.data ?? {}
      const title = payload.notification?.title ?? data.title ?? 'Tether'
      const body = payload.notification?.body ?? data.body ?? ''
      const type = (data.type as string) ?? undefined
      const target = (data.screen as string | undefined) ?? screenFromNotificationUrl((data.url as string | undefined) ?? '')
      const settings = push.loadSettings()

      const willAlert = shouldAlertForType(type, settings)
      const isVisible = document.visibilityState === 'visible'
      debugLog('App.tsx:onForegroundMessage', 'received', { type: type ?? 'none', willAlert, isVisible }, 'H4')
      if (willAlert) {
        if (isVisible) {
          playNotificationSound()
          setToast({ title, body, type })
        } else {
          showSystemNotification(title, body, type ?? 'tether-fg', () => requestNavigation(target))
        }
        return
      }
      if (isVisible) setToast({ title, body, type })
    }).then((unsub) => { unsubscribe = unsub })
    return () => unsubscribe?.()
  }, [session.uid, push, requestNavigation])

  // 세션이 앱 진입 가능 상태를 벗어나면 잠금 상태와 AppContext 캐시를 정리한다.
  useEffect(() => {
    if (session.status === 'signed_out') {
      disconnect()
    }
    if (
      session.status === 'signed_out'
      || session.status === 'no_couple'
      || session.status === 'restore_failed'
    ) {
      setUnlocked(false)
      setScreen('lock')
    }
  }, [session.status, disconnect])

  // connected 세션 → AppContext 캐시 동기화
  useEffect(() => {
    if (session.status !== 'connected' || !session.connection) return
    connect(session.connection)
  }, [session.status, session.connection, connect])

  const handleUnlocked = () => {
    setUnlocked(true)
    const pending = pendingNavRef.current
    if (pending) {
      pendingNavRef.current = null
      navigate(pending)
      return
    }
    const urlScreen = screenFromNotificationUrl(window.location.href)
    if (urlScreen) {
      navigate(urlScreen)
      return
    }
    setScreen(session.status === 'connected' ? 'home' : 'onboarding')
  }

  const handleChangePin = () => {
    setUnlocked(false)
    setScreen('lock')
  }

  const handleDisconnect = () => {
    disconnect()
    setScreen('onboarding')
  }

  if (session.status === 'loading' || session.status === 'restoring') {
    return (
      <div className="screen min-h-screen flex flex-col items-center justify-center gap-md" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <div className="w-12 h-12 rounded-full border-4 animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
        <p className="font-body-md text-body-md" style={{ color: 'var(--color-text-muted)' }}>
          {session.redirecting ? 'Google 로그인을 마무리하고 있어요' : '연결 정보를 확인하고 있어요'}
        </p>
      </div>
    )
  }

  if (session.status === 'signed_out' || session.status === 'no_couple') {
    return <OnboardingScreen onConnected={() => { setUnlocked(false); setScreen('lock') }} />
  }

  if (session.status === 'restore_failed') {
    return <RestoreFailedScreen />
  }

  if (session.status !== 'connected' || !session.connection) {
    return (
      <div className="screen min-h-screen flex flex-col items-center justify-center gap-md" style={{ background: 'var(--color-bg)' }}>
        <p className="font-body-md text-body-md text-on-surface-variant">세션을 준비하고 있어요...</p>
      </div>
    )
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
        {screen === 'history'     && <StatusHistoryScreen onBack={toHome} />}
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
      <SessionProvider>
        <AppProvider>
          <AppWithBadges />
        </AppProvider>
      </SessionProvider>
    </div>
  )
}
