// src/screens/HomeScreen.tsx
// Main dashboard for status, recent activity, and quick navigation.
import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BottomNav } from '../components/BottomNav'
import { MoodChip } from '../components/MoodChip'
import { RecentFeed } from '../components/RecentFeed'
import { PushPermissionBanner } from '../components/PushPermissionBanner'
import { PushTokenHealthBanner } from '../components/PushTokenHealthBanner'
import { useApp } from '../context/AppContext'
import { useAnniversaries } from '../hooks/useAnniversaries'
import { useCoupleSession } from '../hooks/useCoupleSession'
import { useRecentFeed } from '../hooks/useRecentFeed'
import { CONDITION_EMOJI, Condition, useStatus } from '../hooks/useStatus'
import { useStatusOptions } from '../hooks/useStatusOptions'

import { APP_VERSION_LABEL } from '../lib/appVersion'

interface HomeScreenProps {
  onNavigate: (screen: string) => void
}

const CONDITIONS: Condition[] = [
  'very_good', 'good', 'normal', 'sleepy', 'surprised', 'flustered',
  'playful', 'tongue', 'annoyed', 'nauseous', 'angry', 'bad', 'very_bad',
]

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
  const statusOptions = useStatusOptions()

  const [draftStatus, setDraftStatus] = useState<StatusDraft>({
    condition: myStatus.condition,
    mood: myStatus.mood,
    message: myStatus.message,
  })
  const [editMsg, setEditMsg] = useState(myStatus.message)
  const [isEditingStatus, setIsEditingStatus] = useState(false)
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
    handleMsgBlur()
    if (isStatusDirty) {
      updateMyStatus({ ...draftStatus, message: draftMessage })
    }
    setIsEditingStatus(false)
  }

  // Opens the editable status controls from the read-only card.
  const beginStatusEdit = () => {
    setDraftStatus({
      condition: myStatus.condition,
      mood: myStatus.mood,
      message: myStatus.message,
    })
    setEditMsg(myStatus.message)
    setIsEditingStatus(true)
  }

  useEffect(() => {
    const next = {
      condition: myStatus.condition,
      mood: myStatus.mood,
      message: myStatus.message,
    }
    if (!isEditingStatus) setDraftStatus(next)
    if (!isEditingMsg && !isEditingStatus) setEditMsg(next.message)
  }, [isEditingMsg, isEditingStatus, myStatus.condition, myStatus.message, myStatus.mood])

  const myName = myNickname || '나'
  const partnerName = partnerNickname || '자기'
  const urgentAnniversaries = upcoming.filter(({ dday }) => dday >= 0 && dday <= 7).slice(0, 2)

  return (
    <div className="screen min-h-screen text-on-surface pb-32">
      <header className="home-header sticky top-0 z-50 flex w-full items-center justify-between bg-surface px-margin-mobile py-sm">
        <div className="flex items-baseline gap-xs">
          <h1 className="font-headline-md text-headline-md font-semibold text-primary">Tether</h1>
          <span className="font-label-sm text-[11px] text-on-surface-variant">{APP_VERSION_LABEL}</span>
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
        <PushTokenHealthBanner />

        <section className="relative flex flex-col gap-md">
          <article className="home-status-card flex flex-col gap-md rounded-xl border bg-[#F5F2EB] p-md shadow-sm">
            <div className="flex items-center justify-between gap-xs">
              <div className="flex items-center gap-xs">
                <span className="font-label-md text-label-md text-on-surface">{partnerName}</span>
                <div className="h-2 w-2 rounded-full bg-outline-variant" />
              </div>
              <span className="font-label-sm text-[10px] text-outline-variant">{timeAgo(partnerStatus.updatedAt)}</span>
            </div>
            <div className="status-card-inner flex items-center gap-md rounded-2xl p-md">
              <div className="status-face flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl text-[42px] leading-none shadow-sm">
                {CONDITION_EMOJI[partnerStatus.condition]}
              </div>
              <p className="home-status-message flex min-h-[50px] flex-1 items-center text-left font-label-md text-[16px] leading-snug text-on-surface">
                {partnerStatus.message || '아직 메시지가 없어요'}
              </p>
            </div>
            <div className="status-tag-panel flex flex-wrap justify-start gap-xs rounded-2xl p-sm">
              {(partnerStatus.mood.length > 0 ? partnerStatus.mood : ['—']).map((tag) => (
                <MoodChip key={tag} label={tag} active={tag !== '—'} />
              ))}
            </div>
          </article>

          <article className="home-status-card flex flex-col gap-md rounded-xl border-2 border-primary-container bg-[#F5F2EB] p-md shadow-sm">
            <div className="flex items-center justify-between gap-xs">
              <div className="flex items-center gap-xs">
                <span className="font-label-md text-label-md text-on-surface">{myName}</span>
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
              <div className="flex items-center gap-xs">
                <span className="font-label-sm text-[10px] text-outline-variant">{timeAgo(myStatus.updatedAt)}</span>
                {!isEditingStatus && (
                  <button
                    type="button"
                    onClick={beginStatusEdit}
                    className="min-h-[40px] rounded-full border border-primary px-md font-label-sm text-label-sm text-primary"
                  >
                    편집
                  </button>
                )}
              </div>
            </div>

            {!isEditingStatus ? (
              <>
                <div className="status-card-inner flex items-center gap-md rounded-2xl p-md">
                  <div className="status-face status-face-mine flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl text-[42px] leading-none shadow-sm">
                    {CONDITION_EMOJI[myStatus.condition]}
                  </div>
                  <p className="home-status-message flex min-h-[50px] flex-1 items-center text-left font-label-md text-[16px] leading-snug text-on-surface">
                    {myStatus.message || '한줄 메시지...'}
                  </p>
                </div>
                <div className="status-tag-panel flex flex-wrap justify-start gap-xs rounded-2xl p-sm">
                  {(myStatus.mood.length > 0 ? myStatus.mood : ['—']).map((tag) => (
                    <MoodChip key={tag} label={tag} active={tag !== '—'} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="status-card-inner flex items-center gap-md rounded-2xl p-md">
                  <div className="status-face status-face-mine flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl text-[42px] leading-none shadow-sm">
                    {CONDITION_EMOJI[draftStatus.condition]}
                  </div>
                  {isEditingMsg ? (
                    <input
                      autoFocus
                      value={editMsg}
                      onChange={(event) => setEditMsg(event.target.value.slice(0, 30))}
                      onBlur={handleMsgBlur}
                      onKeyDown={(event) => event.key === 'Enter' && handleMsgBlur()}
                      maxLength={30}
                      className="home-status-message min-h-[50px] flex-1 border-b border-primary/40 bg-transparent text-left font-label-md text-[16px] text-on-surface outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setIsEditingMsg(true)}
                      className="home-status-message flex min-h-[50px] flex-1 items-center text-left font-label-md text-[16px] leading-snug text-on-surface transition-colors hover:text-primary"
                    >
                      {draftStatus.message || <span className="text-on-surface-variant/60">한줄 메시지...</span>}
                    </button>
                  )}
                </div>

                <div className="status-edit-grid grid grid-cols-4 gap-xs">
                  {CONDITIONS.map((condition) => (
                    <button
                      key={condition}
                      onClick={() => toggleCondition(condition)}
                      aria-pressed={draftStatus.condition === condition}
                      aria-label={`상태 ${CONDITION_EMOJI[condition]}${draftStatus.condition === condition ? ' 선택됨' : ''}`}
                      className={`flex min-h-[50px] items-center justify-center rounded-xl text-2xl transition-all duration-200 ${
                        draftStatus.condition === condition ? 'active' : ''
                      }`}
                    >
                      {CONDITION_EMOJI[condition]}
                    </button>
                  ))}
                </div>

                <div className="status-edit-tag-panel flex max-h-36 flex-wrap justify-center gap-xs overflow-y-auto rounded-2xl p-sm">
                  {statusOptions.tags.map((tag) => (
                    <button key={tag} onClick={() => toggleMood(tag)} className="min-h-[34px]">
                      <MoodChip label={tag} active={draftStatus.mood.includes(tag)} />
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap justify-center gap-xs rounded-2xl p-sm">
                  {statusOptions.quickMessages.map((message) => (
                    <button
                      key={message}
                      type="button"
                      onClick={() => {
                        setEditMsg(message)
                        setDraftStatus((prev) => ({ ...prev, message }))
                        setIsEditingMsg(false)
                      }}
                      className="hc-readable-box hc-readable-box--pill min-h-[40px] rounded-full border border-outline-variant px-sm font-label-sm text-label-sm text-on-surface"
                    >
                      {message}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={confirmStatus}
                  className="min-h-[50px] w-full rounded-full bg-primary px-md py-sm font-label-md text-label-md text-on-primary transition-transform active:scale-95"
                >
                  상태 확정
                </button>
              </>
            )}
          </article>
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

        <p className="pb-md text-center font-label-sm text-[11px] text-on-surface-variant/70">
          powered by 디또
        </p>
      </main>

      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  )
}
