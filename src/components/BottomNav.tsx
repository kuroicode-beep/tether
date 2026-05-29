// src/components/BottomNav.tsx
// 하단 네비게이션 + 미읽음 배지
import { useApp } from '../context/AppContext'
import { NavTab, useUnreadBadges } from '../hooks/useUnreadBadges'

type Screen = 'home' | 'chat' | 'diary' | 'more'

interface BottomNavProps {
  active: Screen
  onNavigate: (screen: Screen) => void
}

export function BottomNav({ active, onNavigate }: BottomNavProps) {
  const { coupleId, uid } = useApp()
  const { badges, markTabRead } = useUnreadBadges(coupleId, uid)

  const items: { id: Screen; tab?: NavTab; icon: string; label: string }[] = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'chat', tab: 'chat', icon: 'chat_bubble', label: 'Chat' },
    { id: 'diary', tab: 'diary', icon: 'auto_stories', label: 'Diary' },
    { id: 'more', tab: 'more', icon: 'more_horiz', label: 'More' },
  ]

  const handleNavigate = (id: Screen, tab?: NavTab) => {
    if (tab) markTabRead(tab)
    onNavigate(id)
  }

  const renderBadge = (tab?: NavTab) => {
    if (!tab) return null
    const count = badges[tab]
    if (count <= 0) return null
    return (
      <span
        className="absolute -top-1 -right-1 min-w-[8px] h-2 px-[2px] rounded-full text-[8px] font-bold flex items-center justify-center"
        style={{ background: '#FF3B30', color: '#FFFFFF' }}
      >
        {count > 9 ? '•' : count}
      </span>
    )
  }

  return (
    <nav
      className="fixed bottom-0 left-0 w-full flex justify-around items-center pt-sm pb-lg px-xl bg-surface-container-low/80 backdrop-blur-md shadow-sm z-50 rounded-t-xl"
      style={{ height: 'var(--bottom-nav-height)' }}
    >
      {items.map(({ id, tab, icon, label }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => handleNavigate(id, tab)}
            className={
              isActive
                ? 'relative flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-md py-xs scale-95 transition-transform duration-150'
                : 'relative flex flex-col items-center justify-center text-secondary px-md py-xs hover:text-primary transition-colors duration-200'
            }
          >
            <span className="relative">
              <span
                className="material-symbols-outlined"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {icon}
              </span>
              {renderBadge(tab)}
            </span>
            <span className="font-label-sm text-label-sm">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
