import { useState, useCallback } from 'react'
import bcryptjs from 'bcryptjs'

const PIN_KEY = 'tether_pin_hash'
const FAIL_KEY = 'tether_pin_fails'
const LOCK_KEY = 'tether_pin_lock_until'
const LOCK_DURATION_MS = 30_000
const MAX_FAILS = 3

export function usePinAuth() {
  const [failCount, setFailCount] = useState<number>(() => {
    return parseInt(localStorage.getItem(FAIL_KEY) ?? '0', 10)
  })
  const [lockedUntil, setLockedUntil] = useState<number>(() => {
    return parseInt(localStorage.getItem(LOCK_KEY) ?? '0', 10)
  })

  const isLocked = Date.now() < lockedUntil

  const hasPin = Boolean(localStorage.getItem(PIN_KEY))

  const setPin = useCallback(async (pin: string) => {
    const hash = await bcryptjs.hash(pin, 10)
    localStorage.setItem(PIN_KEY, hash)
    localStorage.setItem(FAIL_KEY, '0')
    localStorage.removeItem(LOCK_KEY)
    setFailCount(0)
    setLockedUntil(0)
  }, [])

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (isLocked) return false
    const hash = localStorage.getItem(PIN_KEY)
    if (!hash) return false
    const ok = await bcryptjs.compare(pin, hash)
    if (ok) {
      localStorage.setItem(FAIL_KEY, '0')
      localStorage.removeItem(LOCK_KEY)
      setFailCount(0)
      setLockedUntil(0)
    } else {
      const newFails = failCount + 1
      localStorage.setItem(FAIL_KEY, String(newFails))
      setFailCount(newFails)
      if (newFails >= MAX_FAILS) {
        const until = Date.now() + LOCK_DURATION_MS
        localStorage.setItem(LOCK_KEY, String(until))
        setLockedUntil(until)
      }
    }
    return ok
  }, [failCount, isLocked])

  return { hasPin, isLocked, lockedUntil, failCount, setPin, verifyPin }
}
