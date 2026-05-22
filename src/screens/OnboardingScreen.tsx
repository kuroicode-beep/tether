import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { getOrCreateUid, createUserProfile, findUserByCode, linkCouple } from '../lib/coupleAuth'
import { PushPermissionSheet } from '../components/PushPermissionSheet'
import { usePushNotification } from '../hooks/usePushNotification'

type Step = 'nickname' | 'choice' | 'create' | 'join'

interface OnboardingScreenProps {
  onConnected: () => void
}

export function OnboardingScreen({ onConnected }: OnboardingScreenProps) {
  const { connect } = useApp()
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

  const handleNicknameNext = async () => {
    if (!nickname.trim()) return
    setLoading(true)
    const myUid = await getOrCreateUid()
    const code = await createUserProfile(myUid, nickname.trim())
    setUid(myUid)
    setMyCode(code)
    setLoading(false)
    setStep('choice')
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(myCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 6) return
    setLoading(true)
    setError('')
    const partner = await findUserByCode(code)
    if (!partner) {
      setError('코드를 찾을 수 없어요. 다시 확인해주세요.')
      setLoading(false)
      return
    }
    const coupleId = await linkCouple(uid, partner.uid)
    connect({ uid, coupleId, myNickname: nickname.trim(), partnerNickname: partner.nickname, partnerUid: partner.uid })
    setLoading(false)
    // 알림 권한이 없으면 바텀시트 표시
    if (!push.isGranted() && 'Notification' in window) {
      setShowPushSheet(true)
    } else {
      onConnected()
    }
  }

  // Firebase 없이 데모 진행용
  const handleDemoConnect = () => {
    const demoPartnerUid = 'demo-partner'
    const coupleId = [uid, demoPartnerUid].sort().join('_')
    localStorage.setItem('tether_couple_id', coupleId)
    localStorage.setItem('tether_partner_uid', demoPartnerUid)
    connect({ uid, coupleId, myNickname: nickname.trim() || '나', partnerNickname: '자기', partnerUid: demoPartnerUid })
    // 알림 권한이 없으면 바텀시트 표시
    if (!push.isGranted() && 'Notification' in window) {
      setShowPushSheet(true)
    } else {
      onConnected()
    }
  }

  return (
    <div className="min-h-screen bg-[#EEE9DC] flex flex-col items-center justify-center px-margin-mobile relative overflow-hidden">
      {/* Atmosphere */}
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-30">
        <div className="absolute top-[5%] left-[5%] w-72 h-72 bg-primary-container blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[5%] w-80 h-80 bg-secondary-container blur-[100px] rounded-full" />
      </div>

      {/* Logo */}
      <div className="mb-xl text-center">
        <span className="material-symbols-outlined text-[56px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary tracking-tight">Tether</h1>
        <p className="font-label-md text-label-md text-secondary mt-xs opacity-80">우리만의 공간</p>
      </div>

      <div className="w-full max-w-sm">
        {/* Step: nickname */}
        {step === 'nickname' && (
          <div className="space-y-lg">
            <div className="text-center">
              <h2 className="font-headline-md text-headline-md text-on-surface">닉네임을 알려주세요</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-xs">상대방에게 표시될 이름이에요</p>
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
              {loading ? '잠깐만요...' : '다음'}
            </button>
          </div>
        )}

        {/* Step: choice */}
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
                <p className="font-label-md text-label-md text-on-surface font-semibold">새 코드 생성</p>
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

        {/* Step: create (show code) */}
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
              {copied ? '복사됐어요!' : '코드 복사'}
            </button>
            <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
              상대방이 코드를 입력하면 자동으로 연결돼요
            </p>
            <button
              onClick={handleDemoConnect}
              className="w-full py-sm font-label-sm text-label-sm text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
            >
              데모로 계속하기 (Firebase 없이 테스트)
            </button>
          </div>
        )}

        {/* Step: join (enter code) */}
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

      {/* 커플 연결 직후 알림 권한 요청 바텀시트 */}
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
