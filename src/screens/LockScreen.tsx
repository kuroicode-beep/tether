import { useState, useEffect } from 'react'
import { PinPad } from '../components/PinPad'
import { usePinAuth } from '../hooks/usePinAuth'

interface LockScreenProps {
  onUnlocked: () => void
}

export function LockScreen({ onUnlocked }: LockScreenProps) {
  const { hasPin, isLocked, lockedUntil, setPin, verifyPin } = usePinAuth()
  const [pin, setCurrentPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'enter' | 'setup' | 'confirm'>(hasPin ? 'enter' : 'setup')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0)
  const MAX_LEN = 4

  useEffect(() => {
    if (!isLocked) return
    const interval = setInterval(() => {
      const left = Math.ceil((lockedUntil - Date.now()) / 1000)
      if (left <= 0) {
        setLockSecondsLeft(0)
        clearInterval(interval)
      } else {
        setLockSecondsLeft(left)
      }
    }, 500)
    return () => clearInterval(interval)
  }, [isLocked, lockedUntil])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const handleDigit = async (d: string) => {
    if (isLocked) return
    const next = (step === 'confirm' ? confirmPin : pin) + d

    if (step === 'setup') {
      if (next.length <= MAX_LEN) setCurrentPin(next)
      if (next.length === MAX_LEN) {
        setCurrentPin(next)
        setTimeout(() => setStep('confirm'), 200)
      }
    } else if (step === 'confirm') {
      if (next.length <= MAX_LEN) setConfirmPin(next)
      if (next.length === MAX_LEN) {
        if (next === pin) {
          await setPin(next)
          onUnlocked()
        } else {
          setError('PIN이 일치하지 않아요')
          triggerShake()
          setConfirmPin('')
          setTimeout(() => setError(''), 1500)
        }
      }
    } else {
      if (next.length <= MAX_LEN) setCurrentPin(next)
      if (next.length === MAX_LEN) {
        const ok = await verifyPin(next)
        if (ok) {
          onUnlocked()
        } else {
          setError('PIN이 올바르지 않아요')
          triggerShake()
          setCurrentPin('')
          setTimeout(() => setError(''), 1500)
        }
      }
    }
  }

  const handleDelete = () => {
    if (step === 'confirm') setConfirmPin((p) => p.slice(0, -1))
    else setCurrentPin((p) => p.slice(0, -1))
  }

  const currentLen = step === 'confirm' ? confirmPin.length : pin.length

  const subtitle =
    step === 'setup'
      ? 'PIN을 설정해주세요'
      : step === 'confirm'
      ? 'PIN을 다시 입력해주세요'
      : '우리만의 공간'

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
          <span className="material-symbols-outlined text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            eco
          </span>
        </div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary tracking-tight">Tether</h1>
        <p className="font-label-md text-label-md text-secondary mt-xs opacity-80">{subtitle}</p>
      </header>

      {/* PIN Pad */}
      <main className={`flex flex-col items-center w-full ${shake ? 'animate-bounce' : ''}`}>
        {isLocked ? (
          <div className="text-center space-y-md">
            <span className="material-symbols-outlined text-[48px] text-error">lock</span>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {lockSecondsLeft}초 후 다시 시도해주세요
            </p>
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
          <p className="mt-md font-label-md text-label-md text-error">{error}</p>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full flex justify-center pb-md">
        {step === 'enter' && (
          <button
            className="flex items-center gap-xs px-lg py-md text-secondary hover:text-primary transition-colors duration-300 font-label-md text-label-md"
            onClick={() => console.log('Biometric requested')}
          >
            <span className="material-symbols-outlined text-md">fingerprint</span>
            지문으로 잠금해제
          </button>
        )}
      </footer>
    </div>
  )
}
