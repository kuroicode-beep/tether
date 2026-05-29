// src/screens/StatusHistoryScreen.tsx
// 상태 변경 히스토리 — 날짜별 그룹, 내/파트너 정렬 구분
import { format, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import { useStatusHistory } from '../hooks/useStatusHistory'
import { CONDITION_EMOJI, type Condition } from '../hooks/useStatus'

interface StatusHistoryScreenProps {
  onBack: () => void
}

function formatEntryTime(ts: number | null): string {
  if (!ts) return ''
  return format(ts, 'yyyy.MM.dd a h:mm', { locale: ko })
}

function formatDateLabel(ts: number | null): string {
  if (!ts) return '날짜 없음'
  return format(ts, 'yyyy년 M월 d일 EEEE', { locale: ko })
}

export function StatusHistoryScreen({ onBack }: StatusHistoryScreenProps) {
  const { coupleId, uid, myNickname, partnerNickname } = useApp()
  const history = useStatusHistory(coupleId)

  const myName = myNickname || '나'
  const partnerName = partnerNickname || '자기'

  return (
    <div className="screen min-h-screen text-on-surface pb-xl">
      <header className="sticky top-0 z-50 bg-surface flex items-center gap-sm px-margin-mobile py-sm shadow-sm">
        <button
          onClick={onBack}
          className="p-xs rounded-full hover:bg-surface-container transition-colors"
          aria-label="뒤로"
        >
          <span className="material-symbols-outlined text-primary">arrow_back</span>
        </button>
        <h1 className="font-headline-md text-headline-md font-semibold text-on-surface">상태 로그</h1>
      </header>

      <main className="px-margin-mobile pt-lg space-y-md">
        {history.length === 0 ? (
          <p className="text-center font-body-md text-body-md text-on-surface-variant py-xxl">
            아직 상태 변경 기록이 없어요
          </p>
        ) : (
          history.map((entry, index) => {
            const isMe = entry.uid === uid
            const prev = history[index - 1]
            const showDateDivider =
              !prev?.createdAt ||
              !entry.createdAt ||
              !isSameDay(prev.createdAt, entry.createdAt)

            return (
              <div key={entry.id}>
                {showDateDivider && (
                  <div className="flex items-center gap-sm my-lg">
                    <div className="flex-1 h-px bg-outline-variant/40" />
                    <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">
                      {formatDateLabel(entry.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-outline-variant/40" />
                  </div>
                )}

                <div className={`flex flex-col gap-xs mb-md ${isMe ? 'items-end text-right' : 'items-start text-left'}`}>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {isMe ? myName : partnerName}
                  </span>
                  <div
                    className={`max-w-[85%] rounded-2xl px-md py-sm shadow-sm ${
                      isMe ? 'bg-primary-container text-on-surface' : 'bg-surface-container text-on-surface'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-xs mb-xs">
                      <span className="text-lg">{CONDITION_EMOJI[entry.condition as Condition]}</span>
                      {entry.mood.map((tag) => (
                        <span
                          key={tag}
                          className="px-xs py-[2px] rounded-full bg-secondary-container/60 font-label-sm text-label-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="font-body-md text-body-md leading-relaxed">
                      {entry.message || '—'}
                    </p>
                  </div>
                  <span className="font-label-sm text-[11px] text-outline-variant">
                    {formatEntryTime(entry.createdAt)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}
