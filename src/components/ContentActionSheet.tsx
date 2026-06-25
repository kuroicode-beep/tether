// src/components/ContentActionSheet.tsx
// 본인 게시물 롱프레스 수정/삭제 액션 시트
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'

interface ContentActionSheetProps {
  enabled: boolean
  onEdit: () => void
  onDelete: () => void
  wrapperClassName?: string
  children: ReactNode
}

export function ContentActionSheet({
  enabled,
  onEdit,
  onDelete,
  wrapperClassName,
  children,
}: ContentActionSheetProps) {
  const [open, setOpen] = useState(false)
  const timerRef = useRef<number | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const firstActionRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    firstActionRef.current?.focus()
  }, [open])

  const closeSheet = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

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
    closeSheet()
    if (window.confirm('정말 삭제할까요?')) onDelete()
  }

  return (
    <>
      <div
        ref={triggerRef}
        tabIndex={enabled ? 0 : undefined}
        className={wrapperClassName}
        onTouchStart={handleTouchStart}
        onTouchEnd={clearTimer}
        onTouchMove={clearTimer}
        onKeyDown={(e) => {
          if (!enabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
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
          <div className="fixed inset-0 z-[80] bg-black/30" onClick={closeSheet} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="콘텐츠 작업"
            className="app-fixed-x fixed bottom-0 z-[90] bg-surface rounded-t-3xl px-margin-mobile pt-lg pb-xxl shadow-2xl"
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeSheet()
            }}
          >
            <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />
            <div className="space-y-sm">
              <button
                ref={firstActionRef}
                type="button"
                onClick={() => { closeSheet(); onEdit() }}
                className="w-full min-h-[50px] py-md rounded-xl bg-surface-container font-label-md text-label-md text-on-surface"
              >
                수정
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="w-full min-h-[50px] py-md rounded-xl bg-error/10 font-label-md text-label-md text-error"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={closeSheet}
                className="w-full min-h-[50px] py-md rounded-xl font-label-md text-label-md text-on-surface-variant"
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
