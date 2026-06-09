// src/components/MessageBubble.tsx
// Renders one chat bubble with optional current status emoji.
import { useEffect, useState } from 'react'
import { ChatMessage } from '../hooks/useChat'

interface MessageBubbleProps {
  message: ChatMessage
  isMe: boolean
  showTime: boolean
  showSenderName?: boolean
  senderName?: string
  statusEmoji?: string
  onImageTap?: (url: string) => void
}

// Formats a Firestore timestamp in HH:MM.
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
  statusEmoji,
  onImageTap,
}: MessageBubbleProps) {
  const { type, text, imageUrl, createdAt, readBy, senderUid } = message
  const [imgError, setImgError] = useState(false)
  const isRead = isMe && readBy.filter((uid) => uid !== senderUid).length > 0

  useEffect(() => {
    setImgError(false)
  }, [imageUrl])

  return (
    <div className={isMe ? 'message-mine' : 'message-partner'}>
      {!isMe && showSenderName && senderName && (
        <span className="sender-name">{senderName}</span>
      )}

      {statusEmoji && (
        <span
          className={`mb-[2px] block text-[13px] leading-none ${isMe ? 'text-right' : 'text-left'}`}
          aria-label="현재 상태"
        >
          {statusEmoji}
        </span>
      )}

      {type === 'text' ? (
        <div className="bubble">{text}</div>
      ) : type === 'image' ? (
        imageUrl && !imgError ? (
          <button
            type="button"
            onClick={() => onImageTap?.(imageUrl)}
            className="message-image-btn overflow-hidden rounded-[18px] transition-transform active:scale-95"
          >
            <img
              key={imageUrl}
              src={imageUrl}
              alt="이미지 메시지"
              className="message-image block max-h-[300px] max-w-[220px] object-cover"
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
