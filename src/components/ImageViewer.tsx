import { useEffect } from 'react'

interface ImageViewerProps {
  url: string
  onClose: () => void
  actionLabel?: string
  actionButtonLabel?: string
  onAction?: () => void
}

export function ImageViewer({
  url,
  onClose,
  actionLabel,
  actionButtonLabel = '보내기',
  onAction,
}: ImageViewerProps) {
  // ESC 키로 닫기
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="image-viewer-close absolute z-10 w-[50px] h-[50px] rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        aria-label="닫기"
      >
        <span className="material-symbols-outlined">close</span>
      </button>

      {/* 이미지 — pinch-to-zoom은 CSS touch-action + overflow로 지원 */}
      <div
        className="relative max-w-full max-h-full overflow-auto"
        style={{ touchAction: 'pinch-zoom' }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt="이미지 원본"
          className="max-w-screen max-h-screen object-contain select-none"
          draggable={false}
          style={{ maxWidth: '100vw', maxHeight: '100vh' }}
        />
      </div>

      {onAction && (
        <div
          className="app-fixed-x fixed bottom-0 z-10 rounded-t-2xl bg-black/80 px-margin-mobile py-lg text-white backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-md">
            <span className="font-label-md text-label-md">
              {actionLabel ?? '사진첩으로 보내기'}
            </span>
            <button
              type="button"
              onClick={onAction}
              className="min-h-[50px] rounded-full bg-primary px-lg font-label-md text-label-md text-on-primary active:scale-95 transition-transform"
            >
              {actionButtonLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
