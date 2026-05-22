import { isToday, isYesterday, format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface DateDividerProps {
  timestamp: number
}

function formatDate(ts: number): string {
  const date = new Date(ts)
  if (isToday(date)) return '오늘'
  if (isYesterday(date)) return '어제'
  return format(date, 'M월 d일 (EEE)', { locale: ko })
}

export function DateDivider({ timestamp }: DateDividerProps) {
  return (
    <div className="flex items-center gap-md my-md px-sm">
      <div className="flex-1 h-px bg-outline-variant/30" />
      <span className="font-label-sm text-label-sm text-on-surface-variant/60 text-[11px] px-sm whitespace-nowrap">
        {formatDate(timestamp)}
      </span>
      <div className="flex-1 h-px bg-outline-variant/30" />
    </div>
  )
}
