import { useEffect } from 'react'

interface ImageViewerProps {
  url: string
  onClose: () => void
}

export function ImageViewer({ url, onClose }: ImageViewerProps) {
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
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
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
    </div>
  )
}
