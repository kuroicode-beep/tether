// src/components/ContentActionSheet.tsx
// 본인 게시물 롱프레스 수정/삭제 액션 시트
import { ReactNode, useCallback, useRef, useState } from 'react'

interface ContentActionSheetProps {
  enabled: boolean
  onEdit: () => void
  onDelete: () => void
  children: ReactNode
}

export function ContentActionSheet({ enabled, onEdit, onDelete, children }: ContentActionSheetProps) {
  const [open, setOpen] = useState(false)
  const timerRef = useRef<number | null>(null)

  // 롱프레스 시작
  const handleTouchStart = useCallback(() => {
    if (!enabled) return
    timerRef.current = window.setTimeout(() => setOpen(true), 500)
  }, [enabled])

  // 롱프레스 취소
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handleDelete = () => {
    setOpen(false)
    if (window.confirm('정말 삭제할까요?')) onDelete()
  }

  return (
    <>
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={clearTimer}
        onTouchMove={clearTimer}
        onContextMenu={(e) => {
          if (!enabled) return
          e.preventDefault()
          setOpen(true)
        }}
      >
        {children}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/30" onClick={() => setOpen(false)} />
          <div className="app-fixed-x fixed bottom-0 z-[90] bg-surface rounded-t-3xl px-margin-mobile pt-lg pb-xxl shadow-2xl">
            <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />
            <div className="space-y-sm">
              <button
                type="button"
                onClick={() => { setOpen(false); onEdit() }}
                className="w-full py-md rounded-xl bg-surface-container font-label-md text-label-md text-on-surface"
              >
                수정
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="w-full py-md rounded-xl bg-error/10 font-label-md text-label-md text-error"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full py-md rounded-xl font-label-md text-label-md text-on-surface-variant"
              >
                취소
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
