type Screen = 'home' | 'chat' | 'diary' | 'more'

interface BottomNavProps {
  active: Screen
  onNavigate: (screen: Screen) => void
}

export function BottomNav({ active, onNavigate }: BottomNavProps) {
  const items: { id: Screen; icon: string; label: string }[] = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'chat', icon: 'chat_bubble', label: 'Chat' },
    { id: 'diary', icon: 'auto_stories', label: 'Diary' },
    { id: 'more', icon: 'more_horiz', label: 'More' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center pt-sm pb-lg px-xl bg-surface-container-low/80 backdrop-blur-md shadow-sm z-50 rounded-t-xl">
      {items.map(({ id, icon, label }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={
              isActive
                ? 'flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-md py-xs scale-95 transition-transform duration-150'
                : 'flex flex-col items-center justify-center text-secondary px-md py-xs hover:text-primary transition-colors duration-200'
            }
          >
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {icon}
            </span>
            <span className="font-label-sm text-label-sm">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
