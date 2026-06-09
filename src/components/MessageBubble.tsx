import { useState } from 'react'
import { ChatMessage } from '../hooks/useChat'

interface MessageBubbleProps {
  message: ChatMessage
  isMe: boolean
  showTime: boolean
  showSenderName?: boolean
  senderName?: string
  onImageTap?: (url: string) => void
}

// Firestore 타임스탬프를 HH:MM 형식으로 변환
function formatTime(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export function MessageBubble({
  message,
  isMe,
  showTime,
  showSenderName = false,
  senderName,
  onImageTap,
}: MessageBubbleProps) {
  const { type, text, imageUrl, createdAt, readBy, senderUid } = message
  const [imgError, setImgError] = useState(false)
  const isRead = isMe && readBy.filter((u) => u !== senderUid).length > 0

  return (
    <div className={isMe ? 'message-mine' : 'message-partner'}>
      {!isMe && showSenderName && senderName && (
        <span className="sender-name">{senderName}</span>
      )}

      {type === 'text' ? (
        <div className="bubble">{text}</div>
      ) : type === 'image' ? (
        imageUrl && !imgError ? (
          <button
            type="button"
            onClick={() => onImageTap?.(imageUrl)}
            className="message-image-btn rounded-[18px] overflow-hidden active:scale-95 transition-transform"
          >
            <img
              key={imageUrl}
              src={imageUrl}
              alt="이미지 메시지"
              className="message-image max-w-[220px] max-h-[300px] object-cover block"
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
            />
          </button>
        ) : (
          <div className="bubble message-image-fallback">
            {imgError ? '사진을 불러올 수 없어요' : '사진 전송 중...'}
          </div>
        )
      ) : null}

      {showTime && (
        <div className="message-time">
          <span>{formatTime(createdAt)}</span>
          {isMe && (
            <span
              className={`material-symbols-outlined text-[12px] ${isRead ? 'text-primary' : 'opacity-50'}`}
              style={{ fontVariationSettings: isRead ? "'FILL' 1" : "'FILL' 0" }}
            >
              {isRead ? 'done_all' : 'done'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
