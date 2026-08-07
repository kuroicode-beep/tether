// src/App.tsx
// 앱 루트: Session/AppContext 제공 + status 기반 라우팅
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { AppProvider } from './context/AppContext'
import { useApp } from './context/useApp'
import { SessionProvider } from './context/SessionContext'
import { useSession } from './context/useSession'
import { LockScreen } from './screens/LockScreen'
import { RestoreFailedScreen } from './screens/RestoreFailedScreen'
import { ApprovalPendingScreen } from './screens/ApprovalPendingScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ChatScreen } from './screens/ChatScreen'
import { ToastNotification, ToastPayload } from './components/ToastNotification'
import { ThemeMusicPlayer, type ThemeTrack } from './components/ThemeMusicPlayer'

// 시작에 꼭 필요하지 않은 화면은 지연 로드해 초기 번들을 줄인다.
// PWA가 청크를 미리 캐시하므로 전환 시 추가 네트워크 비용은 없다.
const OnboardingScreen = lazy(() => import('./screens/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen })))
const DiaryScreen = lazy(() => import('./screens/DiaryScreen').then((m) => ({ default: m.DiaryScreen })))
const ContentsScreen = lazy(() => import('./screens/ContentsScreen').then((m) => ({ default: m.ContentsScreen })))
const LibraryScreen = lazy(() => import('./screens/LibraryScreen').then((m) => ({ default: m.LibraryScreen })))
const DateRecipeScreen = lazy(() => import('./screens/LibraryScreen').then((m) => ({ default: m.DateRecipeScreen })))
const LinkShareScreen = lazy(() => import('./screens/LibraryScreen').then((m) => ({ default: m.LinkShareScreen })))
const ListenTogetherScreen = lazy(() => import('./screens/ListenTogetherScreen').then((m) => ({ default: m.ListenTogetherScreen })))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })))
const PhotoAlbum = lazy(() => import('./screens/PhotoAlbum').then((m) => ({ default: m.PhotoAlbum })))
const AnniversaryScreen = lazy(() => import('./screens/AnniversaryScreen').then((m) => ({ default: m.AnniversaryScreen })))
const StatusHistoryScreen = lazy(() => import('./screens/StatusHistoryScreen').then((m) => ({ default: m.StatusHistoryScreen })))
const ReleaseLogScreen = lazy(() => import('./screens/ReleaseLogScreen').then((m) => ({ default: m.ReleaseLogScreen })))
const RelayNovelScreen = lazy(() => import('./screens/RelayNovelScreen').then((m) => ({ default: m.RelayNovelScreen })))
const AdminScreen = lazy(() => import('./screens/AdminScreen').then((m) => ({ default: m.AdminScreen })))

// 지연 로드 화면이 뜨는 동안 보여줄 공통 로딩
function ScreenLoading() {
  return (
    <div className="screen min-h-screen flex flex-col items-center justify-center gap-md" style={{ background: 'var(--color-bg)' }}>
      <div className="w-12 h-12 rounded-full border-4 animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
    </div>
  )
}
import { IOSInstallBanner } from './components/IOSInstallBanner'
import { usePushNotification } from './hooks/usePushNotification'
import { installPushTokenAutoSync } from './lib/pushTokenSync'
import { consumeSidecarUnlockToken, pollSidecarUnlockRequest } from './lib/sidecarUnlock'
import { isPinFreeEmail } from './lib/coupleAuth'

// 잠금 화면에 있는 동안 사이드카 단축키 요청을 확인하는 주기
const SIDECAR_UNLOCK_POLL_MS = 1000
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
import { useListeningTogether } from './hooks/useListeningTogether'
import { UnreadBadgesProvider } from './context/UnreadBadgesContext'
import { db } from './lib/firebase'

type Screen =
  | 'lock' | 'onboarding' | 'home' | 'chat' | 'diary' | 'contents'
  | 'settings' | 'photo' | 'library' | 'listenTogether' | 'links' | 'dateRecipe' | 'history' | 'anniversary' | 'statusHistory' | 'releaseLog' | 'relayNovel'
  | 'admin'

const NAVIGATION_SCREENS = new Set<string>([
  'home',
  'chat',
  'diary',
  'contents',
  'settings',
  'photo',
  'library',
  'listenTogether',
  'relayNovel',
  'links',
  'dateRecipe',
  'history',
  'anniversary',
  'statusHistory',
  'releaseLog',
  'admin',
])

const THEME_TRACK_CACHE_KEY = 'tether_theme_track_v1'
const THEME_PLAYER_STATE_CACHE_KEY = 'tether_theme_player_state_v1'

interface CachedPlayerState {
  hidden: boolean
  playing: boolean
  trackKey: string | null
}

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

// Restores the compact player visibility/playback state for the current device.
function loadCachedPlayerState(): CachedPlayerState {
  try {
    const parsed = JSON.parse(localStorage.getItem(THEME_PLAYER_STATE_CACHE_KEY) ?? 'null') as Partial<CachedPlayerState> | null
    return {
      hidden: parsed?.hidden === true,
      playing: parsed?.playing === true,
      trackKey: typeof parsed?.trackKey === 'string' ? parsed.trackKey : null,
    }
  } catch {
    return { hidden: false, playing: false, trackKey: null }
  }
}

// Persists only local player preferences; the couple playlist itself stays in Firestore.
function cachePlayerState(state: CachedPlayerState) {
  try {
    localStorage.setItem(THEME_PLAYER_STATE_CACHE_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

function toTrackKey(track: ThemeTrack | null): string | null {
  if (!track) return null
  return `${track.id ?? track.url}:${track.url}`
}

function AppContent() {
  const { connect, disconnect } = useApp()
  const session = useSession()
  useTheme()
  const [screen, setScreen] = useState<Screen>('lock')
  const [unlocked, setUnlocked] = useState(false)
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const [themeTrack, setThemeTrack] = useState<ThemeTrack | null>(() => loadCachedThemeTrack())
  const [playerState, setPlayerState] = useState<CachedPlayerState>(() => loadCachedPlayerState())
  const [playerRefreshKey, setPlayerRefreshKey] = useState(0)
  const push = usePushNotification(session.uid)
  const { loadSettings, onForegroundMessage, syncToken, syncSettingsFromServer } = push
  const pendingNavRef = useRef<string | null>(null)
  const sidecarUnlockTriedRef = useRef(false)
  const screenRef = useRef<Screen>('lock')
  const recentNotificationIdsRef = useRef<Map<string, number>>(new Map())
  screenRef.current = screen
  const partnerUid = session.connection?.partnerUid ?? null
  const listeningTogether = useListeningTogether(session.coupleId, session.uid, partnerUid)
  const playerHidden = playerState.hidden
  const playerShouldPlay = playerState.playing

  useEffect(() => {
    cachePlayerState(playerState)
  }, [playerState])

  useEffect(() => {
    return installPushTokenAutoSync({
      uid: session.uid,
      coupleId: session.coupleId,
      status: session.status,
      isLoading: session.isLoading,
      sync: syncToken,
    })
  }, [session.uid, session.coupleId, session.status, session.isLoading, syncToken])

  useEffect(() => {
    if (session.status !== 'connected' || !session.uid) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    void syncToken()
  }, [session.status, session.uid, unlocked, syncToken])

  // 알림 설정의 원본은 서버다. 기기별 로컬 캐시가 서버 값을 덮어쓰지 않도록
  // 접속할 때마다 서버 값을 내려받아 캐시를 맞춘다.
  useEffect(() => {
    if (session.status !== 'connected' || !session.uid) return
    void syncSettingsFromServer()
  }, [session.status, session.uid, syncSettingsFromServer])

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

  const shouldHandleNotification = useCallback((id: string | null | undefined) => {
    if (!id) return true
    const now = Date.now()
    const recent = recentNotificationIdsRef.current
    for (const [key, createdAt] of recent.entries()) {
      if (now - createdAt > 8000) recent.delete(key)
    }
    if (recent.has(id)) return false
    recent.set(id, now)
    return true
  }, [])

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

  const showPlayer = useCallback(() => {
    setPlayerState((current) => ({ ...current, hidden: false }))
  }, [])

  const refreshPlayer = useCallback(() => {
    setPlayerState((current) => ({ ...current, hidden: false, playing: true }))
    setPlayerRefreshKey((current) => current + 1)
  }, [])

  const togglePlayer = useCallback(() => {
    setPlayerState((current) => ({ ...current, hidden: !current.hidden }))
  }, [])

  const updatePlayerPlaying = useCallback((playing: boolean) => {
    setPlayerState((current) => {
      if (current.playing === playing) return current
      return { ...current, playing }
    })
  }, [])

  const updatePlayerTrack = useCallback((track: ThemeTrack | null) => {
    const trackKey = toTrackKey(track)
    setPlayerState((current) => {
      if (current.trackKey === trackKey) return current
      return { ...current, trackKey }
    })
  }, [])

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
      if (!shouldHandleNotification(data.notificationId as string | undefined)) return
      const type = (data.alertType as string) ?? undefined
      const settings = loadSettings()
      if (!shouldAlertForType(type, settings)) return
      // 창에 포커스가 있으면 무음 (토스트만) — 포커스 없을 때만 울린다
      if (!document.hasFocus()) playNotificationSound(settings.sound)
      const title = (data.title as string | undefined) ?? 'Tether'
      const body = (data.body as string | undefined) ?? ''
      setToast({ title, body, type })
    }

    navigator.serviceWorker.addEventListener('message', onSwMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage)
  }, [loadSettings, requestNavigation, shouldHandleNotification])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    onForegroundMessage((payload) => {
      const data = payload.data ?? {}
      const title = payload.notification?.title ?? data.title ?? 'Tether'
      const body = payload.notification?.body ?? data.body ?? ''
      const type = (data.type as string) ?? undefined
      const settings = loadSettings()
      const notificationId = (data.notificationId as string | undefined) ?? `${type ?? 'notification'}-${title}-${body}`
      if (!shouldHandleNotification(notificationId)) return

      const willAlert = shouldAlertForType(type, settings)
      const isVisible = document.visibilityState === 'visible'
      debugLog('App.tsx:onForegroundMessage', 'received', { type: type ?? 'none', willAlert, isVisible }, 'H4')
      if (willAlert) {
        if (isVisible) {
          // 포커스 중이면 무음 토스트, 포커스가 없으면 소리도 함께
          if (!document.hasFocus()) playNotificationSound(settings.sound)
          setToast({ title, body, type })
        }
        return
      }
      if (isVisible) setToast({ title, body, type })
    }).then((unsub) => { unsubscribe = unsub })
    return () => unsubscribe?.()
  }, [session.uid, loadSettings, onForegroundMessage, requestNavigation, shouldHandleNotification])

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

  const handleUnlocked = useCallback(() => {
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
  }, [session.status, navigate])

  // 지정 계정으로 로그인한 경우 PIN 잠금을 생략한다.
  // Google 로그인 + 관리자 승인을 이미 통과한 상태이므로 그것을 인증으로 삼는다.
  useEffect(() => {
    if (session.status !== 'connected' || unlocked) return
    if (!isPinFreeEmail(session.user?.email)) return
    handleUnlocked()
  }, [session.status, session.user, unlocked, handleUnlocked])

  // Windows 사이드카 단축키로 열린 경우에만 PIN을 건너뛴다.
  // 토큰은 로컬 사이드카(127.0.0.1)에서만 검증되므로 다른 기기에서는 통하지 않는다.
  //
  // 두 경로가 필요하다:
  //  1) 창을 새로 연 경우 — 주소의 unlock 토큰을 검증한다
  //  2) 이미 열린 창을 포커스한 경우 — 주소가 새로 오지 않으므로,
  //     잠금 화면에 있는 동안 사이드카에 "방금 단축키가 눌렸는지"를 물어본다
  useEffect(() => {
    if (session.status !== 'connected' || unlocked) return

    let cancelled = false
    let timer = 0

    const grant = () => {
      if (cancelled) return
      handleUnlocked()
    }

    const poll = () => {
      void pollSidecarUnlockRequest().then((granted) => {
        if (cancelled) return
        if (granted) {
          pendingNavRef.current = 'chat'
          grant()
          return
        }
        timer = window.setTimeout(poll, SIDECAR_UNLOCK_POLL_MS)
      })
    }

    if (!sidecarUnlockTriedRef.current) {
      sidecarUnlockTriedRef.current = true
      void consumeSidecarUnlockToken().then((granted) => {
        if (cancelled) return
        if (granted) grant()
        else poll()
      })
    } else {
      poll()
    }

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [session.status, unlocked, handleUnlocked])

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
    return (
      <Suspense fallback={<ScreenLoading />}>
        <OnboardingScreen onConnected={() => { setUnlocked(false); setScreen('lock') }} />
      </Suspense>
    )
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

  // PIN 생략 계정은 잠금 화면이 한 프레임 스쳐 보이지 않도록 렌더 단계에서도 건너뛴다
  const pinFree = isPinFreeEmail(session.user?.email)

  if (!unlocked || screen === 'lock') {
    if (!pinFree) return <LockScreen onUnlocked={handleUnlocked} />
    // 잠금은 생략하되, 효과가 첫 화면을 정하기 전까지 빈 화면이 보이지 않게 한다
    return (
      <div className="screen min-h-screen flex flex-col items-center justify-center gap-md" style={{ background: 'var(--color-bg)' }}>
        <p className="font-body-md text-body-md text-on-surface-variant">들어가는 중이에요...</p>
      </div>
    )
  }

  const toHome = () => setScreen('home')
  const activePlaylist = listeningTogether.activeTracks.length > 0 ? listeningTogether.activeTracks : (themeTrack ? [themeTrack] : [])
  const hasThemePlayer = activePlaylist.length > 0 && session.status === 'connected'
  const showThemePlayer = hasThemePlayer && !playerHidden
  const playlistSignature = activePlaylist.map((track) => `${track.id ?? track.url}:${track.title}`).join('|')

  return (
    <>
      <ToastNotification toast={toast} onNavigate={navigate} onDismiss={() => setToast(null)} />
      <IOSInstallBanner />
      {hasThemePlayer && (
        <ThemeMusicPlayer
          key={`${playerRefreshKey}:${playlistSignature}`}
          tracks={activePlaylist}
          hidden={playerHidden}
          shouldPlay={playerShouldPlay}
          onHide={() => setPlayerState((current) => ({ ...current, hidden: true }))}
          onPlayingChange={updatePlayerPlaying}
          onTrackChange={updatePlayerTrack}
        />
      )}

      <div key={screen} className={`app-screen-slot${showThemePlayer ? ' app-screen-slot--with-theme-music' : ''}`}>
        <Suspense fallback={<ScreenLoading />}>
        {screen === 'onboarding'  && <OnboardingScreen onConnected={() => setScreen('home')} />}
        {screen === 'chat'        && <ChatScreen onBack={toHome} onSetThemeTrack={handleSetThemeTrack} />}
        {screen === 'relayNovel'  && <RelayNovelScreen onBack={toHome} />}
        {screen === 'diary'       && <DiaryScreen onNavigate={navigate} />}
        {screen === 'contents'    && <ContentsScreen onNavigate={navigate} />}
        {screen === 'photo'       && <PhotoAlbum onBack={toHome} />}
        {screen === 'library'     && <LibraryScreen onBack={toHome} onNavigate={navigate} />}
        {screen === 'listenTogether' && <ListenTogetherScreen onBack={toHome} onNavigate={navigate} onShowPlayer={showPlayer} onRefreshPlaylist={refreshPlayer} />}
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
        {screen === 'home' && <HomeScreen onNavigate={navigate} onTogglePlayer={togglePlayer} hasPlayer={activePlaylist.length > 0} isPlayerVisible={showThemePlayer} />}
        </Suspense>
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
