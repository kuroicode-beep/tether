import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  createUserProfile,
  findUserByCode,
  linkCouple,
  restoreConnectionFromProfile,
  waitForCoupleConnection,
} from '../lib/coupleAuth'
import { PushPermissionSheet } from '../components/PushPermissionSheet'
import { usePushNotification } from '../hooks/usePushNotification'
import { useAuth } from '../hooks/useAuth'

type Step = 'nickname' | 'choice' | 'create' | 'join'

interface OnboardingScreenProps {
  onConnected: () => void
}

export function OnboardingScreen({ onConnected }: OnboardingScreenProps) {
  const { connect } = useApp()
  const { user, signInAnon, signInWithGoogle, setCoupleId } = useAuth()
  const [step, setStep] = useState<Step>('nickname')
  const [nickname, setNickname] = useState('')
  const [uid, setUid] = useState('')
  const [myCode, setMyCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showPushSheet, setShowPushSheet] = useState(false)
  const push = usePushNotification(uid || null)

  const enterConnectedApp = async (connectedUid: string) => {
    const restored = await restoreConnectionFromProfile(connectedUid)
    if (!restored) return false
    setCoupleId(restored.coupleId)
    connect(restored)
    onConnected()
    return true
  }

  const prepareUser = async (
    nextUid: string,
    nextNickname: string,
    displayName?: string | null,
  ) => {
    const code = await createUserProfile(nextUid, nextNickname, displayName)
    setUid(nextUid)
    setNickname(nextNickname)
    setMyCode(code)

    const connected = await enterConnectedApp(nextUid)
    if (!connected) setStep('choice')
  }

  const prepareGoogleUser = async (googleUser = user) => {
    if (!googleUser || googleUser.isAnonymous) return
    setLoading(true)
    setError('')
    try {
      const nextNickname = googleUser.displayName?.trim() || nickname.trim() || '나'
      await prepareUser(googleUser.uid, nextNickname, googleUser.displayName)
    } catch {
      setError('Google 로그인 정보를 준비하지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!uid && user && !user.isAnonymous) {
      prepareGoogleUser(user)
    }
  }, [user, uid])

  useEffect(() => {
    if (!uid || step !== 'create') return

    let handled = false
    const unsub = waitForCoupleConnection(uid, async () => {
      if (handled) return
      handled = true
      await enterConnectedApp(uid)
    })

    return () => unsub()
  }, [uid, step])

  const handleNicknameNext = async () => {
    if (!nickname.trim()) return
    setLoading(true)
    setError('')
    try {
      const anonUser = await signInAnon()
      await prepareUser(anonUser.uid, nickname.trim())
    } catch {
      setError('시작 정보를 만들지 못했어요. Firebase 연결을 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleStart = async () => {
    setLoading(true)
    setError('')
    try {
      const googleUser = await signInWithGoogle()
      if (googleUser) await prepareGoogleUser(googleUser)
    } catch {
      setError('Google 로그인을 완료하지 못했어요.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(myCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 6 || !uid) return
    setLoading(true)
    setError('')

    try {
      const partner = await findUserByCode(code)
      if (!partner) {
        setError('코드를 찾을 수 없어요. 다시 확인해주세요.')
        return
      }
      if (partner.uid === uid) {
        setError('내 초대 코드는 입력할 수 없어요.')
        return
      }

      const nextCoupleId = await linkCouple(uid, partner.uid)
      setCoupleId(nextCoupleId)
      connect({
        uid,
        coupleId: nextCoupleId,
        myNickname: nickname.trim() || '나',
        partnerNickname: partner.nickname,
        partnerUid: partner.uid,
      })

      if (!push.isGranted() && 'Notification' in window) {
        setShowPushSheet(true)
      } else {
        onConnected()
      }
    } catch {
      setError('커플 연결에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#EEE9DC] flex flex-col items-center justify-center px-margin-mobile relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-30">
        <div className="absolute top-[5%] left-[5%] w-72 h-72 bg-primary-container blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[5%] w-80 h-80 bg-secondary-container blur-[100px] rounded-full" />
      </div>

      <div className="mb-xl text-center">
        <span className="material-symbols-outlined text-[56px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary tracking-tight">Tether</h1>
        <p className="font-label-md text-label-md text-secondary mt-xs opacity-80">우리만의 공간</p>
      </div>

      <div className="w-full max-w-sm">
        {step === 'nickname' && (
          <div className="space-y-lg">
            <div className="text-center">
              <h2 className="font-headline-md text-headline-md text-on-surface">닉네임을 알려주세요</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-xs">상대방에게 표시될 이름이에요</p>
            </div>
            <button
              onClick={handleGoogleStart}
              disabled={loading}
              className="w-full bg-white text-on-surface rounded-full py-md px-lg font-label-md text-label-md border border-outline-variant/40 flex items-center justify-center gap-sm disabled:opacity-40 active:scale-95 transition-transform"
            >
              <span className="font-bold text-primary">G</span>
              Google로 로그인
            </button>
            <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
              같은 계정으로 접속하면 커플 연결을 다시 불러와요
            </p>
            <div className="flex items-center gap-md">
              <div className="h-px bg-outline-variant/40 flex-1" />
              <span className="font-label-sm text-label-sm text-on-surface-variant">또는</span>
              <div className="h-px bg-outline-variant/40 flex-1" />
            </div>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNicknameNext()}
              placeholder="닉네임 입력"
              maxLength={10}
              autoFocus
              className="w-full bg-[#F5F2EB] rounded-xl px-lg py-md font-body-md text-body-md text-on-surface placeholder-on-surface-variant/40 focus:ring-2 focus:ring-primary-container outline-none border-none"
            />
            <button
              onClick={handleNicknameNext}
              disabled={!nickname.trim() || loading}
              className="w-full bg-primary text-on-primary rounded-full py-md font-label-md text-label-md disabled:opacity-40 active:scale-95 transition-transform"
            >
              {loading ? '잠시만요...' : '닉네임만으로 시작하기'}
            </button>
            {error && <p className="text-center font-label-sm text-label-sm text-error">{error}</p>}
          </div>
        )}

        {step === 'choice' && (
          <div className="space-y-md">
            <div className="text-center mb-lg">
              <h2 className="font-headline-md text-headline-md text-on-surface">연결 방법을 선택해주세요</h2>
            </div>
            <button
              onClick={() => setStep('create')}
              className="w-full bg-[#F5F2EB] rounded-xl p-lg flex items-center gap-md active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary">add_link</span>
              </div>
              <div className="text-left">
                <p className="font-label-md text-label-md text-on-surface font-semibold">내 코드 생성</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">코드를 만들어 상대방에게 보내요</p>
              </div>
            </button>
            <button
              onClick={() => setStep('join')}
              className="w-full bg-[#F5F2EB] rounded-xl p-lg flex items-center gap-md active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary">link</span>
              </div>
              <div className="text-left">
                <p className="font-label-md text-label-md text-on-surface font-semibold">코드 입력하기</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">상대방의 코드를 입력해요</p>
              </div>
            </button>
          </div>
        )}

        {step === 'create' && (
          <div className="space-y-lg">
            <div className="text-center">
              <h2 className="font-headline-md text-headline-md text-on-surface">초대 코드</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-xs">이 코드를 상대방에게 보내주세요</p>
            </div>
            <div className="bg-[#F5F2EB] rounded-xl p-xl text-center shadow-sm">
              <p className="font-display-lg text-display-lg text-primary tracking-[0.2em]">{myCode}</p>
            </div>
            <button
              onClick={handleCopy}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-full py-md font-label-md text-label-md text-on-surface flex items-center justify-center gap-sm active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
              {copied ? '복사했어요' : '코드 복사'}
            </button>
            <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
              상대방이 코드를 입력하면 자동으로 연결돼요
            </p>
          </div>
        )}

        {step === 'join' && (
          <div className="space-y-lg">
            <div className="text-center">
              <h2 className="font-headline-md text-headline-md text-on-surface">코드 입력</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-xs">상대방의 초대 코드를 입력해주세요</p>
            </div>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              maxLength={6}
              autoFocus
              className="w-full bg-[#F5F2EB] rounded-xl px-lg py-md font-headline-md text-headline-md text-center tracking-[0.2em] text-primary placeholder-on-surface-variant/30 focus:ring-2 focus:ring-primary-container outline-none border-none"
            />
            {error && <p className="text-center font-label-sm text-label-sm text-error">{error}</p>}
            <button
              onClick={handleJoin}
              disabled={joinCode.length < 6 || loading}
              className="w-full bg-primary text-on-primary rounded-full py-md font-label-md text-label-md disabled:opacity-40 active:scale-95 transition-transform"
            >
              {loading ? '연결 중...' : '연결하기'}
            </button>
            <button
              onClick={() => { setStep('choice'); setError('') }}
              className="w-full py-sm font-label-sm text-label-sm text-on-surface-variant"
            >
              돌아가기
            </button>
          </div>
        )}
      </div>

      {showPushSheet && (
        <PushPermissionSheet
          onAllow={async () => {
            await push.requestPermission()
            setShowPushSheet(false)
            onConnected()
          }}
          onLater={() => {
            setShowPushSheet(false)
            onConnected()
          }}
        />
      )}
    </div>
  )
}
