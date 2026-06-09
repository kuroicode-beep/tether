// src/screens/StatusHistoryScreen.tsx
// Shows both partners' status changes as a read-only timeline.
import { format, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import { SubScreen } from '../components/SubScreen'
import { ScreenHeader } from '../components/ScreenHeader'
import { useCoupleSession } from '../hooks/useCoupleSession'
import { useStatusHistory, type StatusHistoryEntry } from '../hooks/useStatusHistory'
import { CONDITION_EMOJI, type Condition } from '../hooks/useStatus'

interface StatusHistoryScreenProps {
  onBack: () => void
}

// Formats the day divider label for a status log group.
function formatDateLabel(ts: number | null): string {
  if (!ts) return '날짜 없음'
  return format(ts, 'yyyy년 M월 d일 EEEE', { locale: ko })
}

// Formats a compact timestamp shown under each status log.
function formatTimeLabel(ts: number | null): string {
  if (!ts) return ''
  return format(ts, 'a h:mm', { locale: ko })
}

// Renders a single status change item with emoji, tags, message, and author.
function StatusLogCard({
  entry,
  name,
  isMe,
}: {
  entry: StatusHistoryEntry
  name: string
  isMe: boolean
}) {
  const mood = entry.mood.filter(Boolean)

  return (
    <article className={`flex gap-sm ${isMe ? 'flex-row-reverse text-right' : 'text-left'}`}>
      <div
        className={`mt-xs flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full text-2xl shadow-sm ${
          isMe ? 'bg-primary text-on-primary' : 'bg-secondary-container text-on-surface'
        }`}
        aria-hidden="true"
      >
        {CONDITION_EMOJI[entry.condition as Condition]}
      </div>

      <div className={`min-w-0 flex-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-xs`}>
        <div className="flex flex-wrap items-center gap-xs">
          <span className="font-label-sm text-label-sm text-on-surface-variant">{name}</span>
          <span className="font-label-sm text-[11px] text-outline-variant">{formatTimeLabel(entry.createdAt)}</span>
        </div>

        <div
          className={`max-w-full rounded-2xl px-md py-sm shadow-sm ${
            isMe ? 'bg-primary-container' : 'bg-surface-container'
          }`}
        >
          <div className={`mb-xs flex flex-wrap gap-xs ${isMe ? 'justify-end' : 'justify-start'}`}>
            {mood.length > 0 ? (
              mood.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-secondary-container/80 px-sm py-xs font-label-sm text-label-sm text-on-surface"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-outline-variant/20 px-sm py-xs font-label-sm text-label-sm text-on-surface-variant">
                태그 없음
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap break-words font-body-md text-body-md leading-relaxed text-on-surface">
            {entry.message.trim() || '상태 메시지 없음'}
          </p>
        </div>
      </div>
    </article>
  )
}

export function StatusHistoryScreen({ onBack }: StatusHistoryScreenProps) {
  const { coupleId, uid, isLoading: sessionLoading } = useCoupleSession()
  const { myNickname, partnerNickname } = useApp()
  const { history, loading, error } = useStatusHistory(coupleId)

  const myName = myNickname || '나'
  const partnerName = partnerNickname || '상대방'
  const isBusy = sessionLoading || loading

  return (
    <SubScreen>
      <ScreenHeader title="히스토리" onBack={onBack} />

      <main className="sub-screen-body w-full px-margin-mobile py-lg pb-32">
        <section className="mb-lg rounded-xl bg-[#F5F2EB] p-md shadow-sm">
          <h2 className="font-label-md text-label-md font-semibold text-on-surface">상태 변화 기록</h2>
          <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">
            두 사람이 바꾼 표정 아이콘, 태그, 상태 메시지를 시간 순으로 모아 보여줘요.
          </p>
        </section>

        {error && (
          <div className="mb-md rounded-xl bg-error-container px-md py-sm text-on-error-container">
            <p className="font-body-sm text-body-sm">{error}</p>
          </div>
        )}

        {isBusy && history.length === 0 ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center gap-md py-xxl">
            <span className="material-symbols-outlined animate-spin text-2xl text-outline-variant">
              progress_activity
            </span>
            <p className="font-body-md text-body-md text-on-surface-variant">상태 기록을 불러오는 중...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center gap-md py-xxl text-center">
            <span className="material-symbols-outlined text-[56px] text-primary/30">history</span>
            <p className="font-body-md text-body-md text-on-surface-variant">
              아직 상태 변경 기록이 없어요.
            </p>
            <p className="px-lg font-body-sm text-body-sm text-on-surface-variant/70">
              홈에서 표정, 태그, 상태 메시지를 바꾸면 여기에 쌓입니다.
            </p>
          </div>
        ) : (
          <div className="space-y-lg">
            {history.map((entry, index) => {
              const prev = history[index - 1]
              const showDateDivider =
                !prev?.createdAt ||
                !entry.createdAt ||
                !isSameDay(prev.createdAt, entry.createdAt)
              const isMe = entry.uid === uid

              return (
                <div key={entry.id}>
                  {showDateDivider && (
                    <div className="my-lg flex items-center gap-sm">
                      <div className="h-px flex-1 bg-outline-variant/40" />
                      <span className="shrink-0 font-label-sm text-label-sm text-on-surface-variant">
                        {formatDateLabel(entry.createdAt)}
                      </span>
                      <div className="h-px flex-1 bg-outline-variant/40" />
                    </div>
                  )}

                  <StatusLogCard
                    entry={entry}
                    name={isMe ? myName : partnerName}
                    isMe={isMe}
                  />
                </div>
              )
            })}
          </div>
        )}
      </main>
    </SubScreen>
  )
}
