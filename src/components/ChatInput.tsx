import { useState, useRef } from 'react'

interface ChatInputProps {
  onSendText: (text: string) => void
  onSendImage: (file: File) => void
  disabled?: boolean
  onFocusChange?: (focused: boolean) => void
}

interface ImagePreview {
  file: File
  url: string
}

export function ChatInput({ onSendText, onSendImage, disabled, onFocusChange }: ChatInputProps) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ImagePreview | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // textarea 높이를 내용에 맞게 자동 조절
  const adjustHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  // 전송 후에도 입력창 포커스를 유지해 모바일 키보드가 내려가지 않게 한다
  const keepInputFocus = () => {
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      const end = el.value.length
      el.setSelectionRange(end, end)
    })
  }

  const handleSend = () => {
    if (!text.trim() || disabled) return
    onSendText(text.trim())
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    keepInputFocus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview({ file, url: URL.createObjectURL(file) })
    e.target.value = ''
  }

  const handleConfirmImage = () => {
    if (!preview) return
    onSendImage(preview.file)
    URL.revokeObjectURL(preview.url)
    setPreview(null)
    keepInputFocus()
  }

  const handleCancelImage = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  return (
    <>
      {preview && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={handleCancelImage} />
          <div className="app-fixed-x fixed bottom-0 z-50 bg-surface rounded-t-3xl px-margin-mobile pt-lg pb-xxl shadow-2xl">
            <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />
            <p className="font-label-md text-label-md text-on-surface text-center mb-md font-semibold">
              이 사진을 보낼까요?
            </p>
            <div className="flex justify-center mb-xl">
              <img
                src={preview.url}
                alt="미리보기"
                className="max-h-60 max-w-full rounded-2xl object-contain shadow-md"
              />
            </div>
            <div className="space-y-sm">
              <button type="button" onClick={handleConfirmImage} className="btn-outline w-full active">
                전송
              </button>
              <button
                type="button"
                onClick={handleCancelImage}
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
          aria-label="사진 첨부"
        >
          <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            adjustHeight()
          }}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onKeyDown={handleKeyDown}
          placeholder="메시지 입력..."
          rows={1}
          disabled={disabled}
          enterKeyHint="send"
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
