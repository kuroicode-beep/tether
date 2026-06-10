// src/screens/HomeScreen.tsx
// Main dashboard for status, recent activity, and quick navigation.
import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BottomNav } from '../components/BottomNav'
import { MoodChip } from '../components/MoodChip'
import { RecentFeed } from '../components/RecentFeed'
import { PushPermissionBanner } from '../components/PushPermissionBanner'
import { useApp } from '../context/AppContext'
import { useAnniversaries } from '../hooks/useAnniversaries'
import { useCoupleSession } from '../hooks/useCoupleSession'
import { useRecentFeed } from '../hooks/useRecentFeed'
import { CONDITION_EMOJI, Condition, useStatus } from '../hooks/useStatus'

interface HomeScreenProps {
  onNavigate: (screen: string) => void
}

const APP_VERSION = 'v0.1.0'
const CONDITIONS: Condition[] = ['very_good', 'good', 'normal', 'bad', 'very_bad']
const MOOD_TAGS = ['설렘', '평온', '힘듦', '보고싶어', '행복', '기쁨', '고마움', '슬픔', '우울', '화남']

const NAV_ITEMS: { icon: string; label: string; screen: string }[] = [
  { icon: 'chat', label: '채팅', screen: 'chat' },
  { icon: 'calendar_month', label: '기념일', screen: 'anniversary' },
  { icon: 'auto_stories', label: '교환일기', screen: 'diary' },
  { icon: 'featured_play_list', label: '콘텐츠', screen: 'contents' },
  { icon: 'photo_library', label: '사진첩', screen: 'photo' },
  { icon: 'history', label: '히스토리', screen: 'history' },
]

type StatusDraft = {
  condition: Condition
  mood: string[]
  message: string
}

// Formats a relative timestamp for status cards.
function timeAgo(ts: number | null): string {
  if (!ts) return '방금 전'
  try {
    return formatDistanceToNow(ts, { addSuffix: true, locale: ko })
  } catch {
    return '방금 전'
  }
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { uid, coupleId } = useCoupleSession()
  const { myNickname, partnerNickname, partnerUid } = useApp()
  const { myStatus, partnerStatus, updateMyStatus } = useStatus(coupleId, uid, partnerUid)
  const feedItems = useRecentFeed(coupleId, uid, partnerUid)
  const { firstMet, upcoming, getDday } = useAnniversaries(coupleId)

  const [draftStatus, setDraftStatus] = useState<StatusDraft>({
    condition: myStatus.condition,
    mood: myStatus.mood,
    message: myStatus.message,
  })
  const [editMsg, setEditMsg] = useState(myStatus.message)
  const [isEditingMsg, setIsEditingMsg] = useState(false)
  const draftMessage = isEditingMsg ? editMsg.trim() : draftStatus.message
  const isStatusDirty =
    draftStatus.condition !== myStatus.condition ||
    draftMessage !== myStatus.message ||
    draftStatus.mood.length !== myStatus.mood.length ||
    draftStatus.mood.some((tag) => !myStatus.mood.includes(tag))

  // Closes the one-line status editor and keeps the text as a local draft.
  const handleMsgBlur = () => {
    setIsEditingMsg(false)
    setDraftStatus((prev) => ({ ...prev, message: editMsg.trim() }))
  }

  // Updates the draft status face without writing history.
  const toggleCondition = (condition: Condition) => {
    setDraftStatus((prev) => ({ ...prev, condition }))
  }

  // Toggles one draft mood tag without writing history.
  const toggleMood = (tag: string) => {
    setDraftStatus((prev) => {
      const has = prev.mood.includes(tag)
      const next = has ? prev.mood.filter((item) => item !== tag) : [...prev.mood, tag]
      return { ...prev, mood: next }
    })
  }

  // Persists the draft status and appends exactly one history entry.
  const confirmStatus = () => {
    if (!isStatusDirty) return
    handleMsgBlur()
    updateMyStatus({ ...draftStatus, message: draftMessage })
  }

  useEffect(() => {
    const next = {
      condition: myStatus.condition,
      mood: myStatus.mood,
      message: myStatus.message,
    }
    setDraftStatus(next)
    if (!isEditingMsg) setEditMsg(next.message)
  }, [myStatus.condition, myStatus.message, myStatus.mood])

  const myName = myNickname || '나'
  const partnerName = partnerNickname || '자기'
  const urgentAnniversaries = upcoming.filter(({ dday }) => dday >= 0 && dday <= 7).slice(0, 2)

  return (
    <div className="screen min-h-screen text-on-surface pb-32">
      <header className="home-header sticky top-0 z-50 flex w-full items-center justify-between bg-surface px-margin-mobile py-sm">
        <div className="flex items-baseline gap-xs">
          <h1 className="font-headline-md text-headline-md font-semibold text-primary">Tether</h1>
          <span className="font-label-sm text-[11px] text-on-surface-variant">{APP_VERSION}</span>
        </div>

        <div className="flex items-center gap-xs">
          <button
            className="min-h-[50px] rounded-full px-md font-label-md text-label-md text-primary transition-colors duration-200 hover:bg-surface-container"
            onClick={() => onNavigate('releaseLog')}
            aria-label="업데이트 로그"
          >
            Log
          </button>
          <button
            className="flex min-h-[50px] min-w-[50px] items-center justify-center rounded-full transition-colors duration-200 hover:bg-surface-container"
            onClick={() => onNavigate('more')}
            aria-label="설정"
          >
            <span className="material-symbols-outlined text-primary">settings</span>
          </button>
        </div>
      </header>

      <main className="w-full space-y-lg px-margin-mobile pt-lg">
        <PushPermissionBanner />

        <section className="relative grid grid-cols-2 gap-gutter">
          <div className="home-status-card flex flex-col items-center space-y-sm rounded-xl border-2 border-primary-container bg-[#F5F2EB] p-md text-center shadow-sm">
            <div className="flex items-center gap-xs">
              <span className="font-label-md text-label-md text-on-surface">{myName}</span>
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>

            <div className="flex w-full justify-around py-xs">
              {CONDITIONS.map((condition) => (
                <button
                  key={condition}
                  onClick={() => toggleCondition(condition)}
                  className="rounded-full p-xs text-xl transition-all duration-200"
                  style={
                    draftStatus.condition === condition
                      ? {
                          background: 'var(--color-primary)',
                          transform: 'scale(1.2)',
                          border: '2px solid var(--color-primary)',
                          opacity: 1,
                        }
                      : {
                          background: 'transparent',
                          transform: 'scale(1)',
                          border: '2px solid transparent',
                          opacity: 0.45,
                        }
                  }
                >
                  {CONDITION_EMOJI[condition]}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-xs">
              {MOOD_TAGS.map((tag) => (
                <button key={tag} onClick={() => toggleMood(tag)}>
                  <MoodChip label={tag} active={draftStatus.mood.includes(tag)} />
                </button>
              ))}
            </div>

            {isEditingMsg ? (
              <input
                autoFocus
                value={editMsg}
                onChange={(event) => setEditMsg(event.target.value.slice(0, 30))}
                onBlur={handleMsgBlur}
                onKeyDown={(event) => event.key === 'Enter' && handleMsgBlur()}
                maxLength={30}
                className="home-status-message h-11 w-full border-b border-primary/40 bg-transparent text-center font-label-md text-[15px] text-on-surface outline-none"
              />
            ) : (
              <button
                onClick={() => setIsEditingMsg(true)}
                className="home-status-message flex h-11 w-full items-center justify-center text-center font-label-md text-[15px] leading-snug text-on-surface transition-colors hover:text-primary"
              >
                {draftStatus.message || <span className="text-on-surface-variant/60">한줄 메시지...</span>}
              </button>
            )}
            <button
              type="button"
              onClick={confirmStatus}
              disabled={!isStatusDirty}
              className="min-h-[50px] w-full rounded-full bg-primary px-md py-sm font-label-md text-label-md text-on-primary transition-transform active:scale-95 disabled:opacity-45"
            >
              상태 확정
            </button>
            <span className="font-label-sm text-[10px] text-outline-variant">{timeAgo(myStatus.updatedAt)}</span>
          </div>

          <div className="home-status-card flex flex-col items-center space-y-sm rounded-xl border border-transparent bg-[#F5F2EB] p-md text-center shadow-sm">
            <div className="flex items-center gap-xs">
              <span className="font-label-md text-label-md text-on-surface">{partnerName}</span>
              <div className="h-2 w-2 rounded-full bg-outline-variant" />
            </div>
            <div className="flex w-full justify-around py-xs">
              <div className="p-xs text-xl">{CONDITION_EMOJI[partnerStatus.condition]}</div>
            </div>
            <div className="flex flex-wrap justify-center gap-xs">
              {(partnerStatus.mood.length > 0 ? partnerStatus.mood : ['—']).map((tag) => (
                <MoodChip key={tag} label={tag} active={tag !== '—'} />
              ))}
            </div>
            <p className="home-status-message flex h-11 items-center text-center font-label-md text-[15px] leading-snug text-on-surface">
              {partnerStatus.message || '아직 메시지가 없어요'}
            </p>
            <span className="font-label-sm text-[10px] text-outline-variant">{timeAgo(partnerStatus.updatedAt)}</span>
          </div>
        </section>

        <div className="py-sm">
          <div className="h-1 w-full rounded-full bg-gradient-to-r from-primary to-primary-container opacity-30" />
        </div>

        <RecentFeed
          items={feedItems}
          myName={myName}
          myUid={uid}
          partnerName={partnerName}
          onNavigate={onNavigate}
        />

        <section className="rounded-xl bg-[#F5F2EB] p-lg shadow-sm">
          <div className="grid grid-cols-3 gap-x-gutter gap-y-xl">
            {NAV_ITEMS.map(({ icon, label, screen }) => (
              <button
                key={label}
                onClick={() => onNavigate(screen)}
                className="group flex flex-col items-center gap-xs"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-container transition-transform group-hover:scale-105">
                  <span className="material-symbols-outlined text-3xl text-primary">{icon}</span>
                </div>
                <span className="font-label-md text-label-md text-on-surface">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-2xl bg-[#F5F2EB] shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 to-primary-container/15" />
          <div className="relative flex flex-wrap items-center justify-between gap-sm p-lg">
            {firstMet ? (
              <div className="min-w-0">
                <h3 className="font-headline-md text-headline-md text-on-surface">
                  함께한 지 {getDday(firstMet)}
                </h3>
                {urgentAnniversaries.length > 0 && (
                  <div className="mt-sm flex flex-wrap gap-xs">
                    {urgentAnniversaries.map(({ item }) => (
                      <span
                        key={item.id}
                        className="rounded-full bg-primary-container/60 px-sm py-xs font-label-sm text-label-sm text-on-surface"
                      >
                        {item.label} {getDday(item)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="min-w-0">
                <h3 className="font-headline-md text-headline-md text-on-surface">처음 만난 날을 입력해보세요</h3>
                <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">
                  함께한 날을 홈에서 바로 볼 수 있어요.
                </p>
              </div>
            )}
            <button
              onClick={() => onNavigate('anniversary')}
              className="shrink-0 rounded-full bg-primary px-lg py-sm font-label-md text-label-md text-on-primary transition-transform active:scale-95"
            >
              기념일 관리
            </button>
          </div>
        </section>
      </main>

      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  )
}
