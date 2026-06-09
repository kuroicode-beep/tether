// src/components/BottomNav.tsx
// 하단 네비게이션 + 미읽음 배지 (more 탭 = contents 배지, Settings 진입 시 읽음 처리 안 함)
import { NavTab, useUnreadBadges } from '../context/UnreadBadgesContext'

type Screen = 'home' | 'chat' | 'diary' | 'more'

interface BottomNavProps {
  active: Screen
  onNavigate: (screen: Screen) => void
}

type NavItem = {
  id: Screen
  badgeKey?: NavTab
  icon: string
  label: string
}

export function BottomNav({ active, onNavigate }: BottomNavProps) {
  const { badges } = useUnreadBadges()

  const items: NavItem[] = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'chat', badgeKey: 'chat', icon: 'chat_bubble', label: 'Chat' },
    { id: 'diary', badgeKey: 'diary', icon: 'auto_stories', label: 'Diary' },
    { id: 'more', badgeKey: 'contents', icon: 'more_horiz', label: 'More' },
  ]

  const renderBadge = (badgeKey?: NavTab) => {
    if (!badgeKey) return null
    if (badgeKey === 'chat' && active === 'chat') return null
    if (badgeKey === 'diary' && active === 'diary') return null
    const count = badges[badgeKey]
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
      className="app-fixed-x fixed bottom-0 flex justify-around items-center pt-sm pb-lg px-xl bg-surface-container-low/80 backdrop-blur-md shadow-sm z-50 rounded-t-xl"
      style={{ height: 'var(--bottom-nav-height)' }}
    >
      {items.map(({ id, badgeKey, icon, label }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
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
              {renderBadge(badgeKey)}
            </span>
            <span className="font-label-sm text-label-sm">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
