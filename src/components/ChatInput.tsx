import { useState, useRef } from 'react'

interface ChatInputProps {
  onSendText: (text: string) => void
  onSendImage: (file: File) => void
  disabled?: boolean
}

interface ImagePreview {
  file: File
  url: string
}

export function ChatInput({ onSendText, onSendImage, disabled }: ChatInputProps) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ImagePreview | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const adjustHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const handleSend = () => {
    if (!text.trim() || disabled) return
    onSendText(text.trim())
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
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
    e.target.value = '' // reset so same file can be selected again
  }

  const handleConfirmImage = () => {
    if (!preview) return
    onSendImage(preview.file)
    URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  const handleCancelImage = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  return (
    <>
      {/* 이미지 미리보기 바텀시트 */}
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
              <button
                onClick={handleConfirmImage}
                className="w-full bg-primary text-on-primary rounded-full py-md font-label-md text-label-md active:scale-95 transition-transform"
              >
                전송
              </button>
              <button
                onClick={handleCancelImage}
                className="w-full py-md font-label-md text-label-md text-on-surface-variant"
              >
                취소
              </button>
            </div>
          </div>
        </>
      )}

      {/* 입력창 */}
      <footer className="app-fixed-x fixed bottom-0 bg-surface/90 backdrop-blur-md pt-sm pb-safe px-margin-mobile flex items-end gap-sm shadow-sm"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        {/* 이미지 첨부 버튼 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-primary transition-colors active:scale-90 shrink-0"
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

        {/* 텍스트 입력 */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => { setText(e.target.value); adjustHeight() }}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력..."
            rows={1}
            disabled={disabled}
            className="w-full bg-surface-container rounded-3xl px-lg py-[10px] font-body-md text-body-md text-on-surface placeholder-on-surface-variant/40 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all border-none leading-snug"
            style={{ maxHeight: '120px' }}
          />
        </div>

        {/* 전송 버튼 */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${
            text.trim() && !disabled
              ? 'bg-primary text-on-primary shadow-md'
              : 'bg-surface-container text-outline-variant'
          }`}
        >
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            send
          </span>
        </button>
      </footer>
    </>
  )
}
