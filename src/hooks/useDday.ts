import { differenceInDays, addDays, addYears, isToday } from 'date-fns'

export interface Anniversary {
  label: string
  date: Date
  dday: number      // 양수: 앞으로, 음수: 이미 지남, 0: 오늘!
  isToday: boolean
  isSoon: boolean   // D-7 이내
}

export function useDday(startDate: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 만난 지 며칠째 (당일 = 1일)
  const daysTogether = differenceInDays(today, startDate) + 1

  const getAnniversaries = (): Anniversary[] => {
    const milestones: { label: string; date: Date }[] = [
      { label: '100일',  date: addDays(startDate, 99) },
      { label: '200일',  date: addDays(startDate, 199) },
      { label: '300일',  date: addDays(startDate, 299) },
      { label: '500일',  date: addDays(startDate, 499) },
      { label: '1주년',  date: addYears(startDate, 1) },
      { label: '2주년',  date: addYears(startDate, 2) },
      { label: '3주년',  date: addYears(startDate, 3) },
    ]

    return milestones
      .map(({ label, date }) => {
        const dday = differenceInDays(date, today)
        return {
          label,
          date,
          dday,
          isToday: isToday(date),
          isSoon: dday >= 0 && dday <= 7,
        }
      })
      .sort((a, b) => Math.abs(a.dday) - Math.abs(b.dday)) // 가까운 순
  }

  const getDday = (targetDate: Date) => differenceInDays(targetDate, today)

  const hasAnyTodayAnniversary = () =>
    getAnniversaries().some((a) => a.isToday)

  return { daysTogether, getAnniversaries, getDday, hasAnyTodayAnniversary }
}
