import { useDday } from '../hooks/useDday'

interface AnniversaryCardProps {
  startDate: Date
}

function ddayLabel(dday: number, isToday: boolean): { text: string; highlight: boolean } {
  if (isToday) return { text: '오늘! 🎉', highlight: true }
  if (dday > 0) return { text: `D-${dday}`, highlight: dday <= 7 }
  return { text: `D+${Math.abs(dday)}`, highlight: false }
}

export function AnniversaryCard({ startDate }: AnniversaryCardProps) {
  const { daysTogether, getAnniversaries, hasAnyTodayAnniversary } = useDday(startDate)
  const anniversaries = getAnniversaries()
  const isSpecialDay = hasAnyTodayAnniversary()

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#F5F2EB] shadow-sm">
      {/* 분위기 */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 to-primary-container/15 pointer-events-none" />

      {/* 메인 D-day */}
      <div className="relative p-lg pb-md">
        <p className="font-label-sm text-label-sm text-primary/70 uppercase tracking-widest mb-xs">
          Today's Memory
        </p>
        <div className="flex items-end gap-sm">
          <h3 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            함께한 지 {daysTogether.toLocaleString()}일째
          </h3>
          {isSpecialDay && (
            <span className="text-2xl mb-0.5 animate-bounce">🎉</span>
          )}
        </div>
      </div>

      {/* 기념일 목록 (앞으로 3개만) */}
      <div className="relative px-lg pb-lg space-y-xs">
        {anniversaries
          .filter((a) => a.dday >= -30)   // 30일 이상 지난 것은 숨김
          .slice(0, 4)
          .map((a) => {
            const label = ddayLabel(a.dday, a.isToday)
            return (
              <div
                key={a.label}
                className={`flex items-center justify-between rounded-xl px-md py-sm transition-colors ${
                  a.isToday
                    ? 'bg-primary text-on-primary'
                    : a.isSoon
                    ? 'bg-primary-container/60 text-on-surface'
                    : 'bg-surface-container/50 text-on-surface-variant'
                }`}
              >
                <span className={`font-label-md text-label-md font-semibold ${a.isToday ? '' : ''}`}>
                  {a.label}
                </span>
                <span
                  className={`font-label-md text-label-md font-bold ${
                    a.isToday ? 'text-on-primary' : label.highlight ? 'text-primary' : ''
                  }`}
                >
                  {label.text}
                </span>
              </div>
            )
          })}
      </div>
    </section>
  )
}
