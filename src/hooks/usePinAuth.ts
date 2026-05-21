import bcryptjs from 'bcryptjs'

const PIN_KEY = 'tether_pin_hash'
const FAIL_KEY = 'tether_pin_fails'
const LOCK_KEY = 'tether_pin_locked_until'
const MAX_FAILS = 3
const LOCK_MS = 30_000

export function usePinAuth() {
  const hasPinRegistered = () => !!localStorage.getItem(PIN_KEY)

  const registerPin = async (pin: string): Promise<void> => {
    const hash = await bcryptjs.hash(pin, 10)
    localStorage.setItem(PIN_KEY, hash)
    localStorage.removeItem(FAIL_KEY)
    localStorage.removeItem(LOCK_KEY)
  }

  const verifyPin = async (pin: string): Promise<'ok' | 'fail' | 'locked'> => {
    const lockedUntil = localStorage.getItem(LOCK_KEY)
    if (lockedUntil && Date.now() < Number(lockedUntil)) return 'locked'

    const hash = localStorage.getItem(PIN_KEY)
    if (!hash) return 'fail'

    const ok = await bcryptjs.compare(pin, hash)
    if (ok) {
      localStorage.removeItem(FAIL_KEY)
      localStorage.removeItem(LOCK_KEY)
      return 'ok'
    }

    const fails = Number(localStorage.getItem(FAIL_KEY) ?? '0') + 1
    localStorage.setItem(FAIL_KEY, String(fails))
    if (fails >= MAX_FAILS) {
      localStorage.setItem(LOCK_KEY, String(Date.now() + LOCK_MS))
    }
    return 'fail'
  }

  const getFailCount = () => Number(localStorage.getItem(FAIL_KEY) ?? '0')
  const getLockUntil = () => Number(localStorage.getItem(LOCK_KEY) ?? '0')
  const isLocked = () => Date.now() < getLockUntil()

  const clearPin = () => {
    localStorage.removeItem(PIN_KEY)
    localStorage.removeItem(FAIL_KEY)
    localStorage.removeItem(LOCK_KEY)
  }

  return { hasPinRegistered, registerPin, verifyPin, getFailCount, getLockUntil, isLocked, clearPin }
}
