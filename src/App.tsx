// src/App.tsx
// 앱 루트: Session/AppContext 제공 + status 기반 라우팅
import { useState, useEffect, useCallback, useRef } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { AppProvider, useApp } from './context/AppContext'
import { SessionProvider, useSession } from './context/SessionContext'
import { LockScreen } from './screens/LockScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { RestoreFailedScreen } from './screens/RestoreFailedScreen'
import { ApprovalPendingScreen } from './screens/ApprovalPendingScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ChatScreen } from './screens/ChatScreen'
import { DiaryScreen } from './screens/DiaryScreen'
import { ContentsScreen } from './screens/ContentsScreen'
import { DateRecipeScreen, LibraryScreen, LinkShareScreen } from './screens/LibraryScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { PhotoAlbum } from './screens/PhotoAlbum'
import { AnniversaryScreen } from './screens/AnniversaryScreen'
import { ToastNotification, ToastPayload } from './components/ToastNotification'
import { ThemeMusicPlayer, type ThemeTrack } from './components/ThemeMusicPlayer'
import { StatusHistoryScreen } from './screens/StatusHistoryScreen'
import { ReleaseLogScreen } from './screens/ReleaseLogScreen'
import { AdminScreen } from './screens/AdminScreen'
import { IOSInstallBanner } from './components/IOSInstallBanner'
import { usePushNotification } from './hooks/usePushNotification'
import { installPushTokenAutoSync } from './lib/pushTokenSync'
import {
  playNotificationSound,
  screenFromNotificationUrl,
  shouldAlertForType,
  SW_NAVIGATE_MESSAGE,
  SW_PLAY_SOUND_MESSAGE,
} from './lib/notificationAlert'
import { debugLog } from './lib/debugLog'
import { useTheme } from './hooks/useTheme'
import { useCoupleSession } from './hooks/useCoupleSession'
import { UnreadBadgesProvider } from './context/UnreadBadgesContext'
import { db } from './lib/firebase'

type Screen =
  | 'lock' | 'onboarding' | 'home' | 'chat' | 'diary' | 'contents'
  | 'settings' | 'photo' | 'library' | 'links' | 'dateRecipe' | 'history' | 'anniversary' | 'statusHistory' | 'releaseLog'
  | 'admin'

const NAVIGATION_SCREENS = new Set<string>([
  'home',
  'chat',
  'diary',
  'contents',
  'settings',
  'photo',
  'library',
  'links',
  'dateRecipe',
  'history',
  'anniversary',
  'statusHistory',
  'releaseLog',
  'admin',
])

const THEME_TRACK_CACHE_KEY = 'tether_theme_track_v1'

// Reads the cached theme track only to avoid an empty first paint before Firestore arrives.
function loadCachedThemeTrack(): ThemeTrack | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(THEME_TRACK_CACHE_KEY) ?? 'null') as Partial<ThemeTrack> | null
    if (!parsed || typeof parsed.title !== 'string' || typeof parsed.url !== 'string') return null
    return { title: parsed.title, url: parsed.url }
  } catch {
    return null
  }
}

function cacheThemeTrack(track: ThemeTrack | null) {
  try {
    if (track) localStorage.setItem(THEME_TRACK_CACHE_KEY, JSON.stringify(track))
    else localStorage.removeItem(THEME_TRACK_CACHE_KEY)
  } catch { /* ignore */ }
}

function AppContent() {
  const { connect, disconnect } = useApp()
  const session = useSession()
  useTheme()
  const [screen, setScreen] = useState<Screen>('lock')
  const [unlocked, setUnlocked] = useState(false)
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const [themeTrack, setThemeTrack] = useState<ThemeTrack | null>(() => loadCachedThemeTrack())
  const push = usePushNotification(session.uid)
  const pendingNavRef = useRef<string | null>(null)
  const screenRef = useRef<Screen>('lock')
  screenRef.current = screen

  useEffect(() => {
    return installPushTokenAutoSync({
      uid: session.uid,
      coupleId: session.coupleId,
      status: session.status,
      isLoading: session.isLoading,
      sync: push.syncToken,
    })
  }, [session.uid, session.coupleId, session.status, session.isLoading, push.syncToken])

  useEffect(() => {
    if (session.status !== 'connected' || !session.uid) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    void push.syncToken()
  }, [session.status, session.uid, unlocked, push.syncToken])

  const navigate = useCallback((target: string) => {
    if (target === 'more') setScreen('settings')
    else if (NAVIGATION_SCREENS.has(target)) setScreen(target as Screen)
  }, [])

  useEffect(() => {
    if (session.status !== 'connected' || !unlocked || screen === 'lock') return
    window.history.pushState({ tetherScreen: screen }, '', window.location.href)
  }, [screen, session.status, unlocked])

  useEffect(() => {
    if (session.status !== 'connected' || !unlocked) return

    const handlePopState = () => {
      const current = screenRef.current
      if (current !== 'home' && current !== 'lock') {
        setScreen('home')
      }
      window.history.pushState({ tetherScreen: screenRef.current }, '', window.location.href)
    }

    window.history.replaceState({ tetherScreen: screenRef.current }, '', window.location.href)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [session.status, unlocked])

  const requestNavigation = useCallback((target: string | null | undefined) => {
    if (!target || !NAVIGATION_SCREENS.has(target)) return
    if (!unlocked) {
      pendingNavRef.current = target
      return
    }
    navigate(target)
  }, [unlocked, navigate])

  useEffect(() => {
    if (session.status !== 'connected' || !session.coupleId) {
      setThemeTrack(null)
      return
    }

    return onSnapshot(
      doc(db, 'couples', session.coupleId),
      (snap) => {
        const data = snap.data() as { mainThemeTrack?: Partial<ThemeTrack> } | undefined
        const track = data?.mainThemeTrack
        if (!track || typeof track.title !== 'string' || typeof track.url !== 'string') {
          setThemeTrack(null)
          cacheThemeTrack(null)
          return
        }
        const next = { title: track.title, url: track.url }
        setThemeTrack(next)
        cacheThemeTrack(next)
      },
      (err) => console.warn('[App] theme track listener failed', err),
    )
  }, [session.status, session.coupleId])

  const handleSetThemeTrack = useCallback(async (track: ThemeTrack) => {
    if (!session.coupleId || !session.uid) return
    setThemeTrack(track)
    cacheThemeTrack(track)
    try {
      await setDoc(doc(db, 'couples', session.coupleId), {
        mainThemeTrack: {
          title: track.title,
          url: track.url,
          updatedBy: session.uid,
          updatedAt: serverTimestamp(),
        },
      }, { merge: true })
    } catch (err) {
      console.warn('[App] set theme track failed', err)
    }
  }, [session.coupleId, session.uid])

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
      if (document.visibilityState !== 'visible') return
      const type = (data.alertType as string) ?? undefined
      if (!shouldAlertForType(type, push.loadSettings())) return
      playNotificationSound(push.loadSettings().sound)
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
      const settings = push.loadSettings()

      const willAlert = shouldAlertForType(type, settings)
      const isVisible = document.visibilityState === 'visible'
      debugLog('App.tsx:onForegroundMessage', 'received', { type: type ?? 'none', willAlert, isVisible }, 'H4')
      if (willAlert) {
        if (isVisible) {
          playNotificationSound(settings.sound)
          setToast({ title, body, type })
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
      || session.status === 'approval_pending'
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

  if (session.status === 'approval_pending') {
    return <ApprovalPendingScreen />
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
  const showThemePlayer = themeTrack && session.status === 'connected'

  return (
    <>
      <ToastNotification toast={toast} onNavigate={navigate} onDismiss={() => setToast(null)} />
      <IOSInstallBanner />
      {showThemePlayer && (
        <ThemeMusicPlayer track={themeTrack} />
      )}

      <div key={screen} className={`app-screen-slot${showThemePlayer ? ' app-screen-slot--with-theme-music' : ''}`}>
        {screen === 'onboarding'  && <OnboardingScreen onConnected={() => setScreen('home')} />}
        {screen === 'chat'        && <ChatScreen onBack={toHome} onSetThemeTrack={handleSetThemeTrack} />}
        {screen === 'diary'       && <DiaryScreen onNavigate={navigate} />}
        {screen === 'contents'    && <ContentsScreen onNavigate={navigate} />}
        {screen === 'photo'       && <PhotoAlbum onBack={toHome} />}
        {screen === 'library'     && <LibraryScreen onBack={toHome} onNavigate={navigate} />}
        {screen === 'links'       && <LinkShareScreen onBack={toHome} onNavigate={navigate} />}
        {screen === 'dateRecipe'  && <DateRecipeScreen onBack={toHome} onNavigate={navigate} />}
        {screen === 'history'     && <StatusHistoryScreen onBack={toHome} />}
        {screen === 'anniversary' && <AnniversaryScreen onBack={toHome} />}
        {screen === 'statusHistory' && <StatusHistoryScreen onBack={toHome} />}
        {screen === 'releaseLog'  && <ReleaseLogScreen onBack={toHome} />}
        {screen === 'admin'       && <AdminScreen onBack={() => setScreen('settings')} />}
        {screen === 'settings'    && (
          <SettingsScreen
            onBack={toHome}
            onChangePin={handleChangePin}
            onDisconnect={handleDisconnect}
            onOpenAnniversary={() => setScreen('anniversary')}
            onOpenAdmin={() => setScreen('admin')}
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
