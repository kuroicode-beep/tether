import { useState, useEffect } from 'react'

const LS_KEY = 'tether_ios_banner'

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  // iOS standalone
  if ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone) return true
  // Generic PWA display-mode
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return false
}

function isDismissed(): boolean {
  try { return localStorage.getItem(LS_KEY) === 'dismissed' } catch { return false }
}

export function IOSInstallBanner() {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    // 조건: iOS Safari + 홈화면 추가 안 됨 + 이전에 닫지 않음
    if (isIOS() && !isInStandaloneMode() && !isDismissed()) {
      // 약간 지연 후 표시 (초기 렌더 안정화)
      const t = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(t)
    }
  }, [])

  const handleDismiss = () => {
    setClosing(true)
    try { localStorage.setItem(LS_KEY, 'dismissed') } catch { /* ignore */ }
    setTimeout(() => setVisible(false), 350)
  }

  if (!visible) return null

  return (
    <div
      className={`app-fixed-x fixed bottom-0 z-[100] transition-transform duration-350 ease-out ${
        closing ? 'translate-y-full' : 'translate-y-0'
      }`}
      style={{ animation: closing ? undefined : 'slideUp 0.35s ease-out' }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
      <div className="bg-surface rounded-t-3xl shadow-2xl px-margin-mobile pt-lg pb-[max(env(safe-area-inset-bottom),24px)]">
        {/* 핸들 */}
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />

        {/* 닫기 */}
        <button
          onClick={handleDismiss}
          className="absolute top-lg right-margin-mobile p-xs rounded-full hover:bg-surface-container transition-colors"
          aria-label="닫기"
        >
          <span className="material-symbols-outlined text-outline-variant">close</span>
        </button>

        {/* 제목 */}
        <div className="flex items-center gap-md mb-md">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-md">
            <span className="text-on-primary text-xl">💕</span>
          </div>
          <div>
            <h3 className="font-label-md text-label-md font-semibold text-on-surface">홈 화면에 추가하기</h3>
            <p className="font-label-sm text-label-sm text-on-surface-variant">앱처럼 사용하려면 3단계를 따라해주세요</p>
          </div>
        </div>

        {/* 단계 */}
        <ol className="space-y-sm">
          <li className="flex items-start gap-md bg-surface-container rounded-xl px-md py-sm">
            <span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold shrink-0 mt-[2px]">1</span>
            <div>
              <p className="font-body-md text-body-md text-on-surface">
                하단 공유 버튼{' '}
                <span className="inline-flex items-center gap-xs align-middle">
                  <span className="material-symbols-outlined text-primary text-base">ios_share</span>
                </span>{' '}
                을 누르세요
              </p>
            </div>
          </li>
          <li className="flex items-start gap-md bg-surface-container rounded-xl px-md py-sm">
            <span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold shrink-0 mt-[2px]">2</span>
            <p className="font-body-md text-body-md text-on-surface">
              스크롤해서 <strong className="text-primary">홈 화면에 추가</strong>를 탭하세요
            </p>
          </li>
          <li className="flex items-start gap-md bg-surface-container rounded-xl px-md py-sm">
            <span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold shrink-0 mt-[2px]">3</span>
            <p className="font-body-md text-body-md text-on-surface">
              오른쪽 상단 <strong className="text-primary">추가</strong>를 눌러 완료하세요
            </p>
          </li>
        </ol>

        <button
          onClick={handleDismiss}
          className="w-full mt-lg py-md rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md transition-colors hover:bg-surface-container-high"
        >
          나중에 할게요
        </button>
      </div>
    </div>
  )
}
