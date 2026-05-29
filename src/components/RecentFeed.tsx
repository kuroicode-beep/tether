// src/components/RecentFeed.tsx
// 홈 화면 파트너 최근 활동 피드 목록
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { FeedCategory, FeedItem } from '../hooks/useRecentFeed'

interface RecentFeedProps {
  items: FeedItem[]
  partnerName: string
  onNavigate: (screen: string) => void
}

const CATEGORY_META: Record<FeedCategory, { icon: string; label: (name: string) => string }> = {
  message: { icon: '🗨️', label: (name) => `${name}가 채팅을 보냈어요` },
  diary: { icon: '📖', label: (name) => `${name}가 교환일기를 작성했어요` },
  contents: { icon: '🎬', label: (name) => `${name}가 콘텐츠를 추가했어요` },
  photo: { icon: '📸', label: (name) => `${name}가 사진을 올렸어요` },
  status: { icon: '💭', label: (name) => `${name}가 상태를 변경했어요` },
}

// 상대 시간을 짧은 한국어로 포맷한다
function formatRelative(ts: number): string {
  const diffMs = Date.now() - ts
  if (diffMs < 60_000) return '방금 전'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}분 전`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}시간 전`
  try {
    return formatDistanceToNow(ts, { addSuffix: true, locale: ko })
  } catch {
    return '방금 전'
  }
}

export function RecentFeed({ items, partnerName, onNavigate }: RecentFeedProps) {
  if (items.length === 0) return null

  return (
    <section className="bg-[#F5F2EB] rounded-xl p-md shadow-sm space-y-sm">
      <h2 className="font-label-md text-label-md font-semibold text-on-surface">최근 활동</h2>
      <ul className="space-y-sm">
        {items.map((item) => {
          const meta = CATEGORY_META[item.category]
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onNavigate(item.screen)}
                className="w-full flex items-center gap-sm text-left rounded-xl px-sm py-sm hover:bg-surface-container transition-colors"
              >
                <span className="text-xl shrink-0">{meta.icon}</span>
                <span className="flex-1 font-body-md text-body-md text-on-surface leading-snug">
                  {meta.label(partnerName)}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">
                  {formatRelative(item.createdAt)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
