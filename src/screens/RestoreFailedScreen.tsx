// src/screens/RestoreFailedScreen.tsx
// coupleId는 있으나 couples/partner 복원 실패 시 표시
import { useState } from 'react'
import { useSession } from '../context/SessionContext'

export function RestoreFailedScreen() {
  const { uid, coupleId, error, retryRestore, signOut, redirecting } = useSession()
  const [retrying, setRetrying] = useState(false)

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await retryRestore()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="screen min-h-screen flex flex-col items-center justify-center gap-lg px-margin-mobile text-center">
      <span
        className="material-symbols-outlined text-[56px] text-primary/60"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        cloud_off
      </span>
      <div className="space-y-sm max-w-sm">
        <h1 className="font-headline-md text-headline-md font-semibold text-primary">
          연결 정보를 불러오지 못했어요
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
          계정은 확인됐지만 커플 데이터를 복원하지 못했어요.
          네트워크를 확인한 뒤 다시 시도해주세요.
        </p>
        {error && (
          <p className="font-label-sm text-label-sm text-on-surface-variant/80 break-all">
            {error}
          </p>
        )}
        {import.meta.env.DEV && (
          <p className="font-label-sm text-label-sm opacity-50 break-all">
            uid: {uid ?? '—'} · coupleId: {coupleId ?? '—'}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-sm w-full max-w-xs">
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying || redirecting}
          className="w-full bg-primary text-on-primary rounded-full py-md font-label-md text-label-md disabled:opacity-50 active:scale-95 transition-transform"
        >
          {retrying ? '다시 시도 중...' : '다시 시도'}
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full py-md rounded-full border border-outline-variant font-label-md text-label-md text-on-surface-variant"
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}
