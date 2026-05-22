import { useState } from 'react'

interface PushPermissionSheetProps {
  onAllow: () => Promise<void>
  onLater: () => void
}

export function PushPermissionSheet({ onAllow, onLater }: PushPermissionSheetProps) {
  const [loading, setLoading] = useState(false)

  const handleAllow = async () => {
    setLoading(true)
    await onAllow()
    setLoading(false)
  }

  return (
    <>
      {/* 딤 배경 */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onLater}
      />

      {/* 바텀시트 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-surface px-margin-mobile pt-lg pb-xxl shadow-2xl">
        {/* 핸들 바 */}
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />

        {/* 아이콘 */}
        <div className="flex justify-center mb-md">
          <div className="w-16 h-16 rounded-3xl bg-primary-container flex items-center justify-center">
            <span
              className="material-symbols-outlined text-primary text-4xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              notifications_active
            </span>
          </div>
        </div>

        {/* 문구 */}
        <div className="text-center mb-xl px-sm">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-sm">
            알림을 허용해주세요 🌿
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            푸시 알림을 허용하면 상대방의 메시지와{'\n'}상태 변경을 바로 알 수 있어요
          </p>
        </div>

        {/* iOS 안내 */}
        <div className="bg-secondary-container/40 rounded-xl p-md mb-xl flex items-start gap-sm">
          <span className="material-symbols-outlined text-secondary text-sm mt-0.5">info</span>
          <p className="font-label-sm text-label-sm text-on-surface-variant leading-relaxed">
            iPhone 사용자의 경우 Safari에서 홈 화면에 추가한 후 알림을 허용할 수 있어요
          </p>
        </div>

        {/* 버튼 */}
        <div className="space-y-sm">
          <button
            onClick={handleAllow}
            disabled={loading}
            className="w-full bg-primary text-on-primary rounded-full py-md font-label-md text-label-md disabled:opacity-40 active:scale-95 transition-transform"
          >
            {loading ? '요청 중...' : '허용하기'}
          </button>
          <button
            onClick={onLater}
            className="w-full py-md font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
          >
            나중에
          </button>
        </div>
      </div>
    </>
  )
}
