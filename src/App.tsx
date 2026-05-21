import { useState } from 'react'
import { LockScreen } from './screens/LockScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ChatScreen } from './screens/ChatScreen'
import { DiaryScreen } from './screens/DiaryScreen'
import { ContentsScreen } from './screens/ContentsScreen'
import { SettingsScreen } from './screens/SettingsScreen'

type Screen = 'lock' | 'home' | 'chat' | 'diary' | 'contents' | 'settings' | 'more'

export default function App() {
  const [screen, setScreen] = useState<Screen>('lock')

  const navigate = (target: string) => {
    if (target === 'more') {
      setScreen('contents')
    } else {
      setScreen(target as Screen)
    }
  }

  if (screen === 'lock') {
    return <LockScreen onUnlocked={() => setScreen('home')} />
  }

  if (screen === 'chat') {
    return <ChatScreen onBack={() => setScreen('home')} />
  }

  if (screen === 'settings') {
    return <SettingsScreen onBack={() => setScreen('home')} />
  }

  if (screen === 'diary') {
    return <DiaryScreen onNavigate={(s) => navigate(s)} />
  }

  if (screen === 'contents') {
    return <ContentsScreen onNavigate={(s) => navigate(s)} />
  }

  return <HomeScreen onNavigate={(s) => navigate(s)} />
}
