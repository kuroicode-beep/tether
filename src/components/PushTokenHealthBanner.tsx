// src/components/PushTokenHealthBanner.tsx
// 알림 권한은 허용됐지만 Firestore에 현재 기기 토큰이 없을 때 안내
import { useApp } from '../context/useApp'
import { usePushTokenHealth } from '../hooks/usePushTokenHealth'

export function PushTokenHealthBanner() {
  const { uid } = useApp()
  const { needsResync, resyncing, resync } = usePushTokenHealth(uid)

  if (!needsResync) return null

  return (
    <div
      className="hc-readable-box mx-margin-mobile mb-md rounded-xl px-md py-sm flex flex-col sm:flex-row sm:items-center gap-sm"
      style={{ background: 'var(--color-error-container)', color: 'var(--color-on-surface)' }}
    >
      <p className="flex-1 font-body-md text-body-md leading-snug">
        이 기기 알림 등록이 만료됐을 수 있어요. 다시 등록해주세요.
      </p>
      <button
        type="button"
        onClick={() => void resync()}
        disabled={resyncing}
        className="hc-readable-box hc-readable-box--pill min-h-[50px] shrink-0 px-md py-xs rounded-full bg-primary text-on-primary font-label-md text-label-md disabled:opacity-50 active:scale-95 transition-transform"
      >
        {resyncing ? '등록 중…' : '알림 다시 등록'}
      </button>
    </div>
  )
}
