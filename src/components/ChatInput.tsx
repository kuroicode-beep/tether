import { useEffect, useRef, useState } from 'react'

interface ChatInputProps {
  onSendText: (text: string) => void
  onSendFile: (file: File) => void
  disabled?: boolean
  autoFocus?: boolean
  droppedFile?: { id: number; file: File } | null
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

export function ChatInput({ onSendText, onSendFile, disabled, autoFocus, droppedFile, onFocusChange }: ChatInputProps) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)

  const adjustHeight = () => {
    const el = editorRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const keepInputFocus = () => {
    requestAnimationFrame(() => {
      const el = editorRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }

  useEffect(() => {
    if (!autoFocus || disabled) return
    const timer = window.setTimeout(keepInputFocus, 250)
    return () => window.clearTimeout(timer)
  }, [autoFocus, disabled])

  useEffect(() => {
    if (!droppedFile || disabled) return
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url)
      return { file: droppedFile.file, url: URL.createObjectURL(droppedFile.file) }
    })
  }, [disabled, droppedFile])

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url)
      return { file, url: URL.createObjectURL(file) }
    })
    e.target.value = ''
  }

  const handleConfirmFile = () => {
    if (!preview) return
    onSendFile(preview.file)
    URL.revokeObjectURL(preview.url)
    setPreview(null)
    keepInputFocus()
  }

  const handleCancelFile = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  return (
    <>
      {preview && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={handleCancelFile} />
          <div className="app-fixed-x fixed bottom-0 z-50 bg-surface rounded-t-3xl px-margin-mobile pt-lg pb-xxl shadow-2xl">
            <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />
            <p className="font-label-md text-label-md text-on-surface text-center mb-md font-semibold">
              이 파일을 보낼까요?
            </p>
            <div className="flex justify-center mb-xl">
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
            <div className="space-y-sm">
              <button type="button" onClick={handleConfirmFile} className="btn-outline w-full active">
                전송
              </button>
              <button
                type="button"
                onClick={handleCancelFile}
                className="w-full py-md font-label-md text-label-md opacity-60"
                style={{ color: 'var(--color-text-muted)' }}
              >
                취소
              </button>
            </div>
          </div>
        </>
      )}

      <footer className="chat-input-bar app-fixed-x">
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
          disabled={!text.trim() || disabled}
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
