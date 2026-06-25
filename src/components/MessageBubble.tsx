// src/components/MessageBubble.tsx
// Renders one chat bubble with sender name, media fallback, and read state.
import { useEffect, useState } from 'react'
import { ChatMessage } from '../hooks/useChat'

interface MessageBubbleProps {
  message: ChatMessage
  isMe: boolean
  showTime: boolean
  showSenderName?: boolean
  senderName?: string
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
  onImageTap,
}: MessageBubbleProps) {
  const { type, text, imageUrl, createdAt, readBy, senderUid } = message
  const [imgError, setImgError] = useState(false)
  const isRead = isMe && readBy.filter((uid) => uid !== senderUid).length > 0
  const timeText = formatTime(createdAt)
  const accessibleSender = isMe ? '내가 보낸' : `${senderName ?? '상대방'}이 보낸`
  const accessibleContent = type === 'image'
    ? (imgError ? '불러올 수 없는 사진 메시지' : '사진 메시지')
    : (text || '빈 메시지')
  const accessibilityLabel = `${accessibleSender} 메시지${timeText ? `, ${timeText}` : ''}, ${accessibleContent}`

  useEffect(() => {
    setImgError(false)
  }, [imageUrl])

  return (
    <div className={isMe ? 'message-mine' : 'message-partner'} aria-label={accessibilityLabel}>
      {!isMe && showSenderName && senderName && (
        <span className="sender-name">{senderName}</span>
      )}

      {type === 'text' ? (
        <div className="bubble" role="text">{text}</div>
      ) : type === 'image' ? (
        imageUrl && !imgError ? (
          <button
            type="button"
            onClick={() => onImageTap?.(imageUrl)}
            className="message-image-btn overflow-hidden rounded-[18px] transition-transform active:scale-95"
            aria-label={`${accessibleSender} 사진 메시지 열기`}
          >
            <img
              key={imageUrl}
              src={imageUrl}
              alt={`${accessibleSender} 사진 메시지`}
              className="message-image block max-h-[300px] max-w-[220px] object-cover"
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
            />
          </button>
        ) : (
          <div className="bubble message-image-fallback" role="status" aria-live="polite">
            {imgError ? '사진을 불러올 수 없어요' : '사진 전송 중...'}
          </div>
        )
      ) : null}

      {showTime && (
        <div className="message-time" aria-hidden="true">
          <span>{timeText}</span>
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
