import { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { LockScreen } from './screens/LockScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ChatScreen } from './screens/ChatScreen'
import { DiaryScreen } from './screens/DiaryScreen'
import { ContentsScreen } from './screens/ContentsScreen'
import { SettingsScreen } from './screens/SettingsScreen'

type Screen = 'lock' | 'onboarding' | 'home' | 'chat' | 'diary' | 'contents' | 'settings'

function AppContent() {
  const { isConnected } = useApp()
  const [screen, setScreen] = useState<Screen>('lock')
  const [unlocked, setUnlocked] = useState(false)

  const navigate = (target: string) => {
    if (target === 'more') setScreen('settings')
    else setScreen(target as Screen)
  }

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

  // 연결 해제: 홈으로 이동하면 onboarding 상태이므로 onboarding으로
  const handleDisconnect = () => {
    setScreen('onboarding')
  }

  if (!unlocked || screen === 'lock') {
    return <LockScreen onUnlocked={handleUnlocked} />
  }

  if (screen === 'onboarding') {
    return <OnboardingScreen onConnected={() => setScreen('home')} />
  }

  if (screen === 'chat') {
    return <ChatScreen onBack={() => setScreen('home')} />
  }

  if (screen === 'settings') {
    return (
      <SettingsScreen
        onBack={() => setScreen('home')}
        onChangePin={handleChangePin}
        onDisconnect={handleDisconnect}
      />
    )
  }

  if (screen === 'diary') {
    return <DiaryScreen onNavigate={navigate} />
  }

  if (screen === 'contents') {
    return <ContentsScreen onNavigate={navigate} />
  }

  return <HomeScreen onNavigate={navigate} />
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
