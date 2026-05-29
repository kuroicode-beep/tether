import { useCallback, useEffect, useMemo, useState } from 'react'
import { addYears, differenceInDays } from 'date-fns'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export type AnniversaryType = 'first_met' | 'birthday_me' | 'birthday_partner' | 'custom'

export interface Anniversary {
  id: string
  type: AnniversaryType
  label: string
  date: string
  isYearly: boolean
}

const localKey = (coupleId: string) => `tether_anniversaries_${coupleId}`

const todayStart = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

const parseDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`)
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

const readLocal = (coupleId: string | null): Anniversary[] => {
  if (!coupleId) return []
  try {
    return JSON.parse(localStorage.getItem(localKey(coupleId)) ?? '[]') as Anniversary[]
  } catch {
    return []
  }
}

const saveLocal = (coupleId: string, anniversaries: Anniversary[]) => {
  try {
    localStorage.setItem(localKey(coupleId), JSON.stringify(anniversaries))
  } catch {
    // localStorage can fail in private mode; Firestore still remains the source of truth.
  }
}

export function useAnniversaries(coupleId: string | null) {
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>(() => readLocal(coupleId))

  useEffect(() => {
    setAnniversaries(readLocal(coupleId))
    if (!coupleId) return

    let unsub: (() => void) | undefined
    try {
      unsub = onSnapshot(
        doc(db, 'couples', coupleId),
        (snap) => {
          const next = (snap.data()?.anniversaries ?? []) as Anniversary[]
          setAnniversaries(next)
          saveLocal(coupleId, next)
        },
        () => {
          setAnniversaries(readLocal(coupleId))
        },
      )
    } catch {
      setAnniversaries(readLocal(coupleId))
    }

    return () => {
      try {
        unsub?.()
      } catch {
        // Keep local fallback alive if Firestore listen cleanup fails.
      }
    }
  }, [coupleId])

  const persist = useCallback(async (next: Anniversary[]) => {
    if (!coupleId) return
    setAnniversaries(next)
    saveLocal(coupleId, next)
    try {
      await setDoc(doc(db, 'couples', coupleId), { anniversaries: next }, { merge: true })
    } catch {
      // Offline/local fallback has already been updated.
    }
  }, [coupleId])

  const getTargetDate = useCallback((anniversary: Anniversary) => {
    const target = parseDate(anniversary.date)
    if (!anniversary.isYearly) return target

    const today = todayStart()
    let next = new Date(today.getFullYear(), target.getMonth(), target.getDate())
    next.setHours(0, 0, 0, 0)
    if (next < today) next = addYears(next, 1)
    return next
  }, [])

  const getDdayNumber = useCallback((anniversary: Anniversary) => {
    const today = todayStart()
    const target = getTargetDate(anniversary)
    return differenceInDays(target, today)
  }, [getTargetDate])

  const getDday = useCallback((anniversary: Anniversary): string => {
    const today = todayStart()
    const original = parseDate(anniversary.date)

    if (anniversary.type === 'first_met') {
      return `${Math.max(1, differenceInDays(today, original) + 1).toLocaleString()}일째`
    }

    const diff = anniversary.isYearly
      ? getDdayNumber(anniversary)
      : differenceInDays(original, today)
    if (diff === 0) return 'D-DAY'
    return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`
  }, [getDdayNumber])

  const addAnniversary = useCallback(async (anniversary: Omit<Anniversary, 'id'>) => {
    const nextAnniversary: Anniversary = { ...anniversary, id: crypto.randomUUID() }
    const filtered = anniversary.type === 'first_met'
      ? anniversaries.filter((item) => item.type !== 'first_met')
      : anniversaries
    await persist([...filtered, nextAnniversary])
  }, [anniversaries, persist])

  const removeAnniversary = useCallback(async (anniversary: Anniversary) => {
    await persist(anniversaries.filter((item) => item.id !== anniversary.id))
  }, [anniversaries, persist])

  const updateAnniversary = useCallback(async (updated: Anniversary) => {
    const next = anniversaries.map((item) => item.id === updated.id ? updated : item)
    await persist(next)
  }, [anniversaries, persist])

  const firstMet = useMemo(
    () => anniversaries.find((item) => item.type === 'first_met') ?? null,
    [anniversaries],
  )

  const upcoming = useMemo(() => {
    return anniversaries
      .filter((item) => item.type !== 'first_met')
      .map((item) => ({ item, dday: getDdayNumber(item) }))
      .sort((a, b) => Math.abs(a.dday) - Math.abs(b.dday))
  }, [anniversaries, getDdayNumber])

  return {
    anniversaries,
    firstMet,
    upcoming,
    getDday,
    getDdayNumber,
    addAnniversary,
    removeAnniversary,
    updateAnniversary,
  }
}
