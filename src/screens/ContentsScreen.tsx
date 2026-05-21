import { useState } from 'react'
import { BottomNav } from '../components/BottomNav'

type Screen = 'home' | 'chat' | 'diary' | 'more'
type Category = '전체' | '책' | '영화' | '드라마' | '유튜브' | '기타'
type Status = 'wish' | 'watching' | 'done'

interface ContentItem {
  id: string
  title: string
  category: Exclude<Category, '전체'>
  status: Status
  emoji: string
  note?: string
  addedBy: string
}

interface ContentsScreenProps {
  onNavigate: (screen: Screen) => void
}

const CATEGORIES: Category[] = ['전체', '책', '영화', '드라마', '유튜브', '기타']

const ITEMS: ContentItem[] = [
  { id: '1', title: '불편한 편의점', category: '책', status: 'wish', emoji: '📚', addedBy: '나' },
  { id: '2', title: 'The Bear (시즌 2)', category: '드라마', status: 'watching', emoji: '🎬', note: '요즘 핫한 셰프 드라마! 같이 정주행해요.', addedBy: '자기' },
  { id: '3', title: '파묘 (Exhuma)', category: '영화', status: 'done', emoji: '🎞️', addedBy: '나' },
  { id: '4', title: '침착맨 TRPG 시리즈', category: '유튜브', status: 'wish', emoji: '📺', addedBy: '자기' },
  { id: '5', title: '나솔사계 다시보기', category: '드라마', status: 'watching', emoji: '🍿', addedBy: '나' },
  { id: '6', title: '김창옥의 강연 100회', category: '기타', status: 'wish', emoji: '🎙️', addedBy: '자기' },
]

const STATUS_BADGE: Record<Status, { text: string; className: string }> = {
  wish: { text: '보고싶어요', className: 'bg-[#E8F5E9] text-[#2E7D32]' },
  watching: { text: '보는 중', className: 'bg-[#E3F2FD] text-[#1976D2]' },
  done: { text: '다 봤어요', className: 'bg-primary-container text-on-primary-container' },
}

export function ContentsScreen({ onNavigate }: ContentsScreenProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('전체')

  const filtered =
    activeCategory === '전체' ? ITEMS : ITEMS.filter((i) => i.category === activeCategory)

  return (
    <div className="bg-[#EEE9DC] text-on-surface min-h-screen">
      {/* Header */}
      <header className="bg-[#EEE9DC] w-full top-0 sticky z-40">
        <div className="flex justify-between items-center px-margin-mobile py-sm">
          <h1 className="font-headline-md text-headline-md font-semibold text-primary">같이 볼 것들 🎬</h1>
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-container transition-colors duration-200 shadow-sm active:scale-95">
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-margin-mobile pb-xxl">
        {/* Category Pills */}
        <div className="flex gap-sm overflow-x-auto py-md hide-scrollbar sticky top-[60px] bg-[#EEE9DC] z-30">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-none px-lg py-xs rounded-full font-label-md text-label-md transition-all active:scale-95 ${
                activeCategory === cat
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-high'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Masonry Grid */}
        <div
          className="mt-md"
          style={{ columnCount: 2, columnGap: '16px' }}
        >
          {filtered.map((item) => (
            <div
              key={item.id}
              className="cursor-pointer group"
              style={{ breakInside: 'avoid', marginBottom: '16px' }}
            >
              <div className="bg-[#F5F2EB] rounded-xl overflow-hidden shadow-[0px_2px_12px_rgba(49,98,72,0.06)] hover:shadow-[0px_4px_20px_rgba(49,98,72,0.12)] transition-shadow duration-300">
                <div className="p-md space-y-sm">
                  <div className="flex justify-between items-start">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status].className}`}>
                      {STATUS_BADGE[item.status].text}
                    </span>
                    <span className="text-lg">{item.emoji}</span>
                  </div>
                  <h3 className="font-label-md text-label-md font-bold text-on-surface leading-snug">
                    {item.title}
                  </h3>
                  {item.note && (
                    <p className="text-[12px] text-on-surface-variant leading-relaxed line-clamp-2">
                      {item.note}
                    </p>
                  )}
                  <div className="flex items-center gap-xs pt-xs border-t border-outline-variant/10">
                    <div className="w-5 h-5 rounded-full bg-secondary-container flex items-center justify-center text-[9px] font-bold text-primary">
                      {item.addedBy.slice(0, 1)}
                    </div>
                    <span className="text-[10px] text-on-surface-variant">{item.addedBy} 추가</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-xxl text-center py-xl">
          <div className="inline-block px-xl py-xs bg-primary/5 rounded-full border border-primary/10">
            <p className="text-label-sm font-label-sm text-primary">
              우리의 위시리스트가 {ITEMS.length}개 쌓였어요 ✨
            </p>
          </div>
        </div>
      </main>

      {/* Atmosphere */}
      <div className="fixed top-0 left-1/4 w-[50vw] h-[442px] bg-primary/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-[40vw] h-[353px] bg-secondary-container/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      <BottomNav active="more" onNavigate={onNavigate} />
    </div>
  )
}
