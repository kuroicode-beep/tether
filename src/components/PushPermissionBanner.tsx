// src/components/PushPermissionBanner.tsx
// PC/모바일 Web Push 권한 유도 배너 (한 번 닫으면 재표시 안 함)
import { useState } from 'react'
import { canRequestPushPermission, usePushNotification } from '../hooks/usePushNotification'
import { useApp } from '../context/AppContext'

const LS_DISMISSED = 'pushDismissed'

export function PushPermissionBanner() {
  const { uid } = useApp()
  const push = usePushNotification(uid)
  const [loading, setLoading] = useState(false)
  const [hidden, setHidden] = useState(() => localStorage.getItem(LS_DISMISSED) === 'true')

  if (hidden) return null
  if (!canRequestPushPermission()) return null
  if (Notification.permission !== 'default') return null
  if (push.isGranted()) return null

  const dismiss = () => {
    localStorage.setItem(LS_DISMISSED, 'true')
    setHidden(true)
  }

  const handleAllow = async () => {
    setLoading(true)
    await push.requestPermission()
    localStorage.setItem(LS_DISMISSED, 'true')
    setHidden(true)
    setLoading(false)
  }

  return (
    <div
      className="mx-margin-mobile mb-md rounded-xl px-md py-sm flex flex-col sm:flex-row sm:items-center gap-sm"
      style={{ background: 'var(--color-primary-container)', color: 'var(--color-on-surface)' }}
    >
      <p className="flex-1 font-body-md text-body-md leading-snug">
        💬 새 메시지 알림을 받으시겠어요?
      </p>
      <div className="flex gap-sm shrink-0">
        <button
          onClick={handleAllow}
          disabled={loading}
          className="px-md py-xs rounded-full bg-primary text-on-primary font-label-md text-label-md disabled:opacity-50 active:scale-95 transition-transform"
        >
          {loading ? '요청 중...' : '허용하기'}
        </button>
        <button
          onClick={dismiss}
          className="px-md py-xs rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
        >
          나중에
        </button>
      </div>
    </div>
  )
}
