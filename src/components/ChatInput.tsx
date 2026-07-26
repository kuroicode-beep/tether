import { useEffect, useRef, useState } from 'react'

interface ChatInputProps {
  onSendText: (text: string) => void
  onSendFile: (file: File, caption?: string) => void
  disabled?: boolean
  autoFocus?: boolean
  incomingFiles?: { id: number; files: File[] } | null
  onFocusChange?: (focused: boolean) => void
}

interface FilePreview {
  file: File
  url: string
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function ChatInput({ onSendText, onSendFile, disabled, autoFocus, incomingFiles, onFocusChange }: ChatInputProps) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [fileQueue, setFileQueue] = useState<File[]>([])
  const [caption, setCaption] = useState('')
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const composingRef = useRef(false)

  // 입력 바의 실제 높이를 --chat-input-h로 노출한다.
  // 안전영역 여백이나 여러 줄 입력으로 높이가 바뀌어도 메시지 목록 여백이 따라간다.
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const root = document.documentElement

    const update = () => {
      const height = Math.round(el.getBoundingClientRect().height)
      if (height > 0) root.style.setProperty('--chat-input-h', `${height}px`)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--chat-input-h')
    }
  }, [])

  // textarea 자동 높이 — 줄어들 수 있을 때만 auto로 되감아 iOS 레이아웃 흔들림을 줄인다
  const adjustHeight = () => {
    const el = editorRef.current
    if (!el) return
    if (el.scrollHeight <= el.clientHeight) el.style.height = 'auto'
    const next = `${Math.min(el.scrollHeight, 120)}px`
    if (el.style.height !== next) el.style.height = next
  }

  // 전송 후 커서를 입력창 끝으로 되돌린다.
  // 이미 포커스가 살아 있으면 focus()를 다시 부르지 않는다 — iOS에서 키보드가 내렸다 올라온다.
  const keepInputFocus = () => {
    requestAnimationFrame(() => {
      const el = editorRef.current
      if (!el) return
      if (document.activeElement !== el) el.focus({ preventScroll: true })
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }

  useEffect(() => {
    if (!autoFocus || disabled) return
    const timers = [60, 250, 650].map((delay) => window.setTimeout(keepInputFocus, delay))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [autoFocus, disabled])

  const appendFiles = (files: File[]) => {
    const validFiles = files.filter((file) => file.size > 0)
    if (validFiles.length === 0) return
    setPreview((current) => {
      if (current) {
        setFileQueue((queue) => [...queue, ...validFiles])
        return current
      }
      setFileQueue((queue) => [...queue, ...validFiles.slice(1)])
      return {
        file: validFiles[0],
        url: URL.createObjectURL(validFiles[0]),
      }
    })
  }

  useEffect(() => {
    if (!incomingFiles || disabled) return
    appendFiles(incomingFiles.files)
  }, [disabled, incomingFiles])

  const handleSend = () => {
    const current = editorRef.current?.value ?? text
    const trimmed = current.trim()
    if (!trimmed || disabled || composingRef.current) return
    onSendText(trimmed)
    setText('')
    if (editorRef.current) {
      editorRef.current.value = ''
      editorRef.current.style.height = 'auto'
    }
    keepInputFocus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || composingRef.current) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.currentTarget.value
    setText(next.replace(/\u00a0/g, ' '))
    adjustHeight()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files ?? [])
    if (files.length === 0) return
    e.preventDefault()
    e.stopPropagation()
    appendFiles(files)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    appendFiles(files)
    e.target.value = ''
  }

  // 다음 대기 파일로 넘어가며 캡션은 파일마다 새로 입력받는다
  const showNextQueuedFile = (queue: File[]) => {
    const [nextFile, ...rest] = queue
    setFileQueue(rest)
    setCaption('')
    setPreview(nextFile ? { file: nextFile, url: URL.createObjectURL(nextFile) } : null)
  }

  const handleConfirmFile = () => {
    if (!preview) return
    onSendFile(preview.file, caption.trim() || undefined)
    URL.revokeObjectURL(preview.url)
    showNextQueuedFile(fileQueue)
    keepInputFocus()
  }

  const handleCancelFile = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    showNextQueuedFile(fileQueue)
  }

  const handleCancelAllFiles = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setFileQueue([])
    setCaption('')
    setPreview(null)
  }

  return (
    <>
      {preview && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={handleCancelAllFiles} />
          <div className="attachment-sheet app-fixed-x fixed z-50 bg-surface rounded-t-3xl px-margin-mobile pt-lg pb-xxl shadow-2xl">
            <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />
            <p className="font-label-md text-label-md text-on-surface text-center mb-md font-semibold">
              이 파일을 보낼까요? {fileQueue.length > 0 ? `(${fileQueue.length + 1}개 중 1개)` : ''}
            </p>
            <div className="flex justify-center mb-lg">
              {isImageFile(preview.file) ? (
                <img
                  src={preview.url}
                  alt="미리보기"
                  className="max-h-60 max-w-full rounded-2xl object-contain shadow-md"
                />
              ) : (
                <div className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container p-lg text-center shadow-sm">
                  <span className="material-symbols-outlined mb-sm text-4xl text-primary">
                    {preview.file.type.startsWith('audio/') ? 'audio_file' : 'description'}
                  </span>
                  <p className="break-all font-label-md text-label-md text-on-surface">{preview.file.name}</p>
                  <p className="mt-xs font-label-sm text-label-sm text-on-surface-variant">
                    {preview.file.type || '알 수 없는 파일'} · {formatFileSize(preview.file.size)}
                  </p>
                </div>
              )}
            </div>

            <label htmlFor="attachment-caption" className="sr-only">
              {isImageFile(preview.file) ? '사진 설명' : '파일 설명'}
            </label>
            <textarea
              id="attachment-caption"
              className="attachment-caption-input mb-lg"
              placeholder={isImageFile(preview.file) ? '사진에 남길 말 (선택)' : '파일에 남길 말 (선택)'}
              value={caption}
              rows={1}
              maxLength={500}
              onChange={(e) => setCaption(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleConfirmFile()
                }
              }}
            />

            <div className="space-y-sm">
              <button type="button" onClick={handleConfirmFile} className="btn-outline w-full active">
                전송
              </button>
              {fileQueue.length > 0 && (
                <button type="button" onClick={handleCancelFile} className="btn-outline w-full">
                  이 파일 건너뛰기
                </button>
              )}
              <button
                type="button"
                onClick={handleCancelAllFiles}
                className="w-full py-md font-label-md text-label-md opacity-60"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {fileQueue.length > 0 ? '전체 취소' : '취소'}
              </button>
            </div>
          </div>
        </>
      )}

      <footer ref={barRef} className="chat-input-bar app-fixed-x">
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="img-btn"
          aria-label="파일 첨부"
        >
          <span className="material-symbols-outlined text-xl">attach_file</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,audio/*,.zip,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.hwp,.hwpx,.csv,.json"
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          ref={editorRef}
          aria-label="메시지 입력"
          rows={1}
          value={text}
          disabled={disabled}
          placeholder="메시지 입력..."
          className="chat-input-editor"
          onChange={handleChange}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={(e) => {
            composingRef.current = false
            setText(e.currentTarget.value.replace(/\u00a0/g, ' '))
            requestAnimationFrame(adjustHeight)
          }}
          style={{ maxHeight: '120px' }}
        />

        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={handleSend}
          disabled={disabled}
          aria-disabled={!text.trim() || disabled}
          data-inactive={!text.trim() ? 'true' : undefined}
          className="send-btn"
          aria-label="전송"
        >
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            send
          </span>
        </button>
      </footer>
    </>
  )
}
