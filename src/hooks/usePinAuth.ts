// bcryptjs는 브라우저 메인스레드를 블로킹함 → Web Crypto API(PBKDF2)로 교체
// PBKDF2: 100,000 iterations, SHA-256, salt 16바이트
// 기존 bcrypt 해시와 호환 안 되므로 localStorage 초기화 필요

const PIN_KEY = 'tether_pin_hash'
const FAIL_KEY = 'tether_pin_fails'
const LOCK_KEY = 'tether_pin_locked_until'
const MAX_FAILS = 3
const LOCK_MS = 30_000
// DEV: 1,000 iterations (fast), PROD: 100,000 iterations (secure)
const ITERATIONS = import.meta.env.DEV ? 1_000 : 100_000

async function deriveKey(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  )
  return new Uint8Array(bits)
}

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveKey(pin, salt)
  // salt(16B) + hash(32B) → base64
  const combined = new Uint8Array(48)
  combined.set(salt)
  combined.set(hash, 16)
  return btoa(String.fromCharCode(...combined))
}

async function verifyHash(pin: string, stored: string): Promise<boolean> {
  try {
    const combined = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0))
    if (combined.length !== 48) return false
    const salt = combined.slice(0, 16)
    const storedHash = combined.slice(16)
    const derived = await deriveKey(pin, salt)
    // constant-time compare
    let diff = 0
    for (let i = 0; i < 32; i++) diff |= derived[i] ^ storedHash[i]
    return diff === 0
  } catch {
    return false
  }
}

export function usePinAuth() {
  const hasPinRegistered = () => !!localStorage.getItem(PIN_KEY)

  const registerPin = async (pin: string): Promise<void> => {
    const hash = await hashPin(pin)
    localStorage.setItem(PIN_KEY, hash)
    localStorage.removeItem(FAIL_KEY)
    localStorage.removeItem(LOCK_KEY)
  }

  const verifyPin = async (pin: string): Promise<'ok' | 'fail' | 'locked'> => {
    const lockedUntil = localStorage.getItem(LOCK_KEY)
    if (lockedUntil && Date.now() < Number(lockedUntil)) return 'locked'

    const hash = localStorage.getItem(PIN_KEY)
    if (!hash) return 'fail'

    const ok = await verifyHash(pin, hash)
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
