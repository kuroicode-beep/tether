// src/components/RecentFeed.tsx
// Shows recent activity from both partners.
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { FeedCategory, FeedItem } from '../hooks/useRecentFeed'

interface RecentFeedProps {
  items: FeedItem[]
  myName: string
  myUid: string | null
  partnerName: string
  onNavigate: (screen: string) => void
}

const CATEGORY_META: Record<FeedCategory, { icon: string; label: (name: string) => string }> = {
  message: { icon: '💬', label: (name) => `${name}가 채팅을 보냈어요` },
  diary: { icon: '📖', label: (name) => `${name}가 교환일기를 작성했어요` },
  contents: { icon: '🎬', label: (name) => `${name}가 콘텐츠를 추가했어요` },
  photo: { icon: '📷', label: (name) => `${name}가 사진을 올렸어요` },
  status: { icon: '💭', label: (name) => `${name}가 상태를 변경했어요` },
}

// Formats recent activity times in short Korean labels.
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

export function RecentFeed({ items, myName, myUid, partnerName, onNavigate }: RecentFeedProps) {
  if (items.length === 0) return null

  return (
    <section className="space-y-sm rounded-xl bg-[#F5F2EB] p-md shadow-sm">
      <h2 className="font-label-md text-label-md font-semibold text-on-surface">최근 활동</h2>
      <ul className="space-y-sm">
        {items.map((item) => {
          const meta = CATEGORY_META[item.category]
          const actorName = item.authorUid === myUid ? myName : partnerName
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onNavigate(item.screen)}
                className="recent-feed-item flex w-full items-center gap-sm rounded-xl px-sm py-sm text-left transition-colors hover:bg-surface-container"
              >
                <span className="shrink-0 text-xl">{meta.icon}</span>
                <span className="flex-1 font-body-md text-body-md leading-snug text-on-surface">
                  {meta.label(actorName)}
                </span>
                <span className="shrink-0 font-label-sm text-label-sm text-on-surface-variant">
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
