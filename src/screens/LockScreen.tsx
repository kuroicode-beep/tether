import { useState, useEffect, useCallback } from 'react'
import { PinPad } from '../components/PinPad'
import { usePinAuth } from '../hooks/usePinAuth'
import { useBiometric } from '../hooks/useBiometric'

interface LockScreenProps {
  onUnlocked: () => void
}

const MAX_LEN = 4
const MAX_FAILS = 3

export function LockScreen({ onUnlocked }: LockScreenProps) {
  const { hasPinRegistered, registerPin, verifyPin, getFailCount, getLockUntil, isLocked } = usePinAuth()
  const bio = useBiometric()

  const isSetup = !hasPinRegistered()
  const [step, setStep] = useState<'enter' | 'setup' | 'confirm'>(isSetup ? 'setup' : 'enter')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0)
  const [failCount, setFailCount] = useState(getFailCount)

  // 잠금 카운트다운
  useEffect(() => {
    if (!isLocked()) return
    const tick = () => {
      const left = Math.ceil((getLockUntil() - Date.now()) / 1000)
      setLockSecondsLeft(Math.max(0, left))
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [getLockUntil, isLocked])

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }, [])

  const showError = useCallback((msg: string) => {
    setError(msg)
    triggerShake()
    setTimeout(() => setError(''), 1800)
  }, [triggerShake])

  // 생체인증 자동 시도
  useEffect(() => {
    if (step !== 'enter' || !bio.isSupported() || !bio.isRegistered()) return
    bio.authenticate().then((ok) => { if (ok) onUnlocked() })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDigit = useCallback(async (d: string) => {
    if (isLocked()) return

    if (step === 'setup') {
      const next = pin + d
      if (next.length > MAX_LEN) return
      setPin(next)
      if (next.length === MAX_LEN) {
        setTimeout(() => { setStep('confirm'); setPin(next) }, 150)
      }
    } else if (step === 'confirm') {
      const next = confirmPin + d
      if (next.length > MAX_LEN) return
      setConfirmPin(next)
      if (next.length === MAX_LEN) {
        if (next === pin) {
          await registerPin(next)
          onUnlocked()
        } else {
          showError('PIN이 일치하지 않아요')
          setConfirmPin('')
        }
      }
    } else {
      const next = pin + d
      if (next.length > MAX_LEN) return
      setPin(next)
      if (next.length === MAX_LEN) {
        const result = await verifyPin(next)
        if (result === 'ok') {
          onUnlocked()
        } else if (result === 'locked') {
          setPin('')
          setLockSecondsLeft(Math.ceil((getLockUntil() - Date.now()) / 1000))
        } else {
          const fails = getFailCount()
          setFailCount(fails)
          const remaining = MAX_FAILS - fails
          showError(
            remaining > 0
              ? `PIN이 올바르지 않아요 (${remaining}회 남음)`
              : '잠깐 기다려주세요',
          )
          setPin('')
        }
      }
    }
  }, [step, pin, confirmPin, isLocked, getLockUntil, getFailCount, registerPin, verifyPin, onUnlocked, showError])

  const handleDelete = useCallback(() => {
    if (step === 'confirm') setConfirmPin((p) => p.slice(0, -1))
    else setPin((p) => p.slice(0, -1))
  }, [step])

  const handleBiometric = async () => {
    const ok = await bio.authenticate()
    if (ok) {
      onUnlocked()
    } else {
      showError('생체인증 실패 — 번호를 입력해주세요')
    }
  }

  const currentLen = step === 'confirm' ? confirmPin.length : pin.length
  const subtitle = step === 'setup' ? 'PIN을 설정해주세요' : step === 'confirm' ? 'PIN을 다시 입력해주세요' : '우리만의 공간'
  const locked = isLocked()

  return (
    <div className="flex flex-col items-center justify-between min-h-screen py-xxl px-margin-mobile select-none relative overflow-hidden">
      {/* Atmosphere */}
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-40">
        <div className="absolute top-[10%] left-[10%] w-64 h-64 bg-primary-container blur-[100px] rounded-full" />
        <div className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-secondary-container blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="flex flex-col items-center text-center">
        <div className="mb-sm text-primary">
          <span className="material-symbols-outlined text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
        </div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary tracking-tight">Tether</h1>
        <p className="font-label-md text-label-md text-secondary mt-xs opacity-80">{subtitle}</p>
      </header>

      {/* Body */}
      <main className={`flex flex-col items-center w-full gap-sm ${shake ? 'animate-bounce' : ''}`}>
        {locked ? (
          <div className="text-center space-y-md py-xl">
            <span className="material-symbols-outlined text-[56px] text-error">lock</span>
            <p className="font-headline-md text-headline-md text-on-surface">{lockSecondsLeft}초</p>
            <p className="font-body-md text-body-md text-on-surface-variant">잠시 후 다시 시도해주세요</p>
          </div>
        ) : (
          <PinPad
            pinLength={currentLen}
            maxLength={MAX_LEN}
            onDigit={handleDigit}
            onDelete={handleDelete}
          />
        )}
        {error && (
          <p className="mt-sm font-label-md text-label-md text-error text-center">{error}</p>
        )}
        {/* 실패 횟수 표시 */}
        {step === 'enter' && !locked && failCount > 0 && !error && (
          <p className="font-label-sm text-label-sm text-outline">
            {MAX_FAILS - failCount}회 더 틀리면 잠겨요
          </p>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full flex justify-center pb-md">
        {step === 'enter' && !locked && bio.isSupported() && bio.isRegistered() && (
          <button
            onClick={handleBiometric}
            className="flex items-center gap-xs px-lg py-md text-secondary hover:text-primary transition-colors font-label-md text-label-md"
          >
            <span className="material-symbols-outlined">fingerprint</span>
            지문으로 잠금해제
          </button>
        )}
      </footer>
    </div>
  )
}
