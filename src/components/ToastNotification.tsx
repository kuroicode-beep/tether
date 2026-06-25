import { useEffect, useState } from 'react'

export interface ToastPayload {
  title: string
  body: string
  type?: 'message' | 'status' | 'diary' | string
  coupleId?: string
}

interface ToastNotificationProps {
  toast: ToastPayload | null
  onNavigate?: (screen: string) => void
  onDismiss: () => void
}

const TYPE_ICON: Record<string, string> = {
  message: 'chat_bubble',
  status: 'favorite',
  diary: 'auto_stories',
}

export function ToastNotification({ toast, onNavigate, onDismiss }: ToastNotificationProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) { setVisible(false); return }
    // 마운트 직후 visible 트랜지션
    requestAnimationFrame(() => setVisible(true))

    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300) // 애니메이션 후 제거
    }, 3000)

    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  const icon = TYPE_ICON[toast.type ?? ''] ?? 'notifications'

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  const handleTap = () => {
    setVisible(false)
    setTimeout(() => {
      onDismiss()
      if (toast.type === 'message') onNavigate?.('chat')
      else if (toast.type === 'diary') onNavigate?.('diary')
      else if (toast.type === 'status') onNavigate?.('home')
    }, 150)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`app-fixed-x fixed top-0 z-[100] flex justify-center px-margin-mobile pt-safe-top transition-transform duration-300 ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      <div
        className="toast-panel hc-readable-box w-full max-w-sm bg-surface/95 backdrop-blur-md rounded-2xl shadow-lg border border-outline-variant/20 px-lg py-md flex items-center gap-md text-left transition-transform"
      >
        {/* 아이콘 */}
        <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-xl">{icon}</span>
        </div>
        {/* 텍스트 */}
        <button
          type="button"
          onClick={handleTap}
          className="flex-1 min-w-0 text-left active:scale-[0.99] transition-transform"
          aria-label={`${toast.title}, ${toast.body}`}
        >
          <p className="font-label-md text-label-md text-on-surface font-semibold truncate">{toast.title}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant truncate">{toast.body}</p>
        </button>
        {/* 닫기 */}
        <button
          type="button"
          onClick={handleDismiss}
          className="min-h-[50px] min-w-[50px] rounded-full p-xs text-outline-variant hover:text-on-surface transition-colors"
          aria-label="알림 닫기"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    </div>
  )
}
