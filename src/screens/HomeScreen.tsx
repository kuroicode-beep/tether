import { StatusCard } from '../components/StatusCard'
import { BottomNav } from '../components/BottomNav'

type Screen = 'home' | 'chat' | 'diary' | 'more'

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void
}

const NAV_ITEMS = [
  { icon: 'chat', label: '채팅', screen: 'chat' as Screen },
  { icon: 'calendar_month', label: '기념일', screen: 'more' as Screen },
  { icon: 'auto_stories', label: '교환일기', screen: 'diary' as Screen },
  { icon: 'featured_play_list', label: '컨텐츠', screen: 'more' as Screen },
  { icon: 'photo_library', label: '사진첩', screen: 'more' as Screen },
  { icon: 'history', label: '히스토리', screen: 'more' as Screen },
]

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  return (
    <div className="min-h-screen text-on-surface pb-32">
      {/* TopAppBar */}
      <header className="w-full top-0 sticky bg-surface flex justify-between items-center px-margin-mobile py-sm z-50">
        <h1 className="font-headline-md text-headline-md font-semibold text-primary">Tether</h1>
        <button
          className="p-xs hover:bg-surface-container transition-colors duration-200 rounded-full"
          onClick={() => onNavigate('more')}
        >
          <span className="material-symbols-outlined text-primary">settings</span>
        </button>
      </header>

      <main className="max-w-md mx-auto px-margin-mobile space-y-lg pt-lg">
        {/* Status Cards */}
        <section className="grid grid-cols-2 gap-gutter">
          <StatusCard
            name="나"
            isMe
            mood="😊"
            tags={['설렘', '평온']}
            message="오늘 하루도 고마워!"
            updatedAt="방금 전"
            online
          />
          <StatusCard
            name="자기"
            mood="😴"
            tags={['힘듦', '보고싶어']}
            message="졸려... 빨리 집 가고 싶다"
            updatedAt="15분 전"
          />
        </section>

        {/* Tether Line */}
        <div className="py-sm">
          <div className="h-1 w-full bg-gradient-to-r from-primary to-primary-container rounded-full opacity-30" />
        </div>

        {/* Quick Nav Grid */}
        <section className="bg-[#F5F2EB] rounded-xl p-lg shadow-sm">
          <div className="grid grid-cols-3 gap-y-xl gap-x-gutter">
            {NAV_ITEMS.map(({ icon, label, screen }) => (
              <button
                key={label}
                onClick={() => onNavigate(screen)}
                className="flex flex-col items-center gap-xs group"
              >
                <div className="w-14 h-14 rounded-2xl bg-secondary-container flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-primary text-3xl">{icon}</span>
                </div>
                <span className="font-label-md text-label-md text-on-surface">{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Featured / D-day */}
        <section className="relative overflow-hidden rounded-xl bg-surface-container-highest p-lg h-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary-container/20" />
          <div className="relative z-10">
            <p className="font-label-sm text-label-sm text-primary uppercase tracking-widest mb-xs">
              Today's memory
            </p>
            <h3 className="font-headline-md text-headline-md text-on-surface">함께한 지 1,245일째</h3>
          </div>
        </section>
      </main>

      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  )
}
