import { BottomNav } from '../components/BottomNav'

type Screen = 'home' | 'chat' | 'diary' | 'more'

interface DiaryEntry {
  id: string
  author: string
  isMe: boolean
  title: string
  preview: string
  time: string
  status: 'new' | 'read' | 'replied'
  blurred?: boolean
}

interface DiaryScreenProps {
  onNavigate: (screen: Screen) => void
}

const ENTRIES: DiaryEntry[] = [
  {
    id: '1',
    author: '자기',
    isMe: false,
    title: '오늘 우리 같이 갔던 카페...',
    preview: '네가 그 케이크 정말 좋아해서 나도 너무 행복했어. 사실 거기 가기 전부터 네가 좋아할지 걱정했는데...',
    time: '오후 9:45',
    status: 'new',
    blurred: true,
  },
  {
    id: '2',
    author: '나',
    isMe: true,
    title: '비 오는 화요일의 기록',
    preview: '퇴근길에 비가 많이 오더라. 너는 우산 잘 챙겼어? 갑자기 네가 해준 따뜻한 차 한 잔이 생각나서...',
    time: '어제',
    status: 'read',
  },
  {
    id: '3',
    author: '자기',
    isMe: false,
    title: '꿈속에서도 만났네',
    preview: '오늘 아침에 일어났는데 너무 기분이 좋았어. 꿈에서 우리 같이 바다 보러 갔었거든. 파도 소리가...',
    time: '2일 전',
    status: 'replied',
  },
  {
    id: '4',
    author: '나',
    isMe: true,
    title: '전시회 리스트 정리',
    preview: '이번 주말에 갈만한 전시회 몇 개 찾아봤어. 1번은 네가 좋아하는 작가꺼고, 2번은...',
    time: '3일 전',
    status: 'read',
  },
]

const STATUS_BADGE: Record<DiaryEntry['status'], { text: string; className: string }> = {
  new: { text: '새 일기', className: 'bg-primary-container text-on-primary-container' },
  read: { text: '읽음', className: 'bg-surface-variant text-on-surface-variant' },
  replied: { text: '답장 완료', className: 'bg-secondary-fixed text-on-secondary-fixed-variant' },
}

const BORDER_COLOR: Record<DiaryEntry['status'], string> = {
  new: 'border-l-primary-container',
  read: 'border-l-secondary-fixed-dim',
  replied: 'border-l-primary/40',
}

export function DiaryScreen({ onNavigate }: DiaryScreenProps) {
  return (
    <div className="bg-background text-on-background min-h-screen pb-32">
      {/* Header */}
      <header className="w-full top-0 sticky z-50 bg-surface flex justify-between items-center px-margin-mobile py-sm">
        <h1 className="font-headline-md text-headline-md font-semibold text-primary">교환일기 💌</h1>
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors duration-200 text-primary">
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>
      </header>

      <main className="max-w-[600px] mx-auto px-margin-mobile pb-32 pt-md space-y-md">
        {/* Connection bar */}
        <div className="py-sm">
          <div className="flex justify-between items-end mb-xs px-xs">
            <span className="text-label-sm font-label-sm text-secondary uppercase tracking-widest">
              Our Connection
            </span>
            <span className="text-label-sm font-label-sm text-primary font-bold">Day 412</span>
          </div>
          <div className="h-2 w-full bg-secondary-container rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-primary-container w-3/4 rounded-full" />
          </div>
        </div>

        {/* Diary entries */}
        <div className="flex flex-col gap-md">
          {ENTRIES.map((entry) => (
            <div
              key={entry.id}
              className={`relative bg-[#F5F2EB] rounded-xl border-l-[6px] p-md shadow-sm transition-all active:scale-[0.98] ${
                BORDER_COLOR[entry.status]
              } ${entry.status === 'new' ? 'pulse-glow' : 'hover:shadow-md'} ${
                entry.status === 'read' || entry.status === 'replied' ? 'opacity-90' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-sm">
                <div className="flex items-center gap-sm">
                  <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-primary text-xs font-bold">
                    {entry.isMe ? 'ME' : entry.author.slice(0, 1)}
                  </div>
                  <div>
                    <p className="font-label-md text-label-md text-on-background font-semibold">
                      {entry.author}
                    </p>
                    <p className="text-label-sm text-label-sm text-on-surface-variant">{entry.time}</p>
                  </div>
                </div>
                <span
                  className={`px-sm py-xs rounded-full text-[10px] font-bold tracking-tight uppercase ${
                    STATUS_BADGE[entry.status].className
                  }`}
                >
                  {STATUS_BADGE[entry.status].text}
                </span>
              </div>

              <div className="space-y-xs">
                <h3 className="font-headline-md text-primary font-handwritten text-2xl">{entry.title}</h3>
                <p
                  className={`text-on-surface-variant font-handwritten text-xl leading-snug ${
                    entry.blurred ? 'diary-blur' : ''
                  }`}
                >
                  {entry.preview}
                </p>
              </div>

              {entry.status === 'replied' && (
                <div className="mt-sm pt-sm border-t border-on-background/5 flex items-center gap-xs">
                  <span
                    className="material-symbols-outlined text-primary text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    reply
                  </span>
                  <span className="text-label-sm font-label-sm text-primary">답장을 보냈어요</span>
                </div>
              )}

              {entry.status === 'new' && (
                <div className="mt-sm flex justify-end">
                  <span className="material-symbols-outlined text-primary-container">lock</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      <BottomNav active="diary" onNavigate={onNavigate} />
    </div>
  )
}
