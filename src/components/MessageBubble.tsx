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

function formatFileSize(size?: number): string {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function MessageBubble({
  message,
  isMe,
  showTime,
  showSenderName = false,
  senderName,
  onImageTap,
}: MessageBubbleProps) {
  const { type, text, imageUrl, fileUrl, fileName, fileType, fileSize, createdAt, readBy, senderUid } = message
  const [imgError, setImgError] = useState(false)
  const isRead = isMe && readBy.filter((uid) => uid !== senderUid).length > 0
  const timeText = formatTime(createdAt)
  const accessibleSender = isMe ? '내가 보낸' : `${senderName ?? '상대방'}이 보낸`
  const accessibleContent = type === 'image'
    ? (imgError ? '불러올 수 없는 사진 메시지' : '사진 메시지')
    : type === 'file'
      ? `${fileName ?? '파일'} 파일 메시지`
    : (text || '빈 메시지')
  const accessibilityLabel = `${accessibleSender} 메시지${timeText ? `, ${timeText}` : ''}, ${accessibleContent}`
  const isAudio = type === 'file' && (fileType?.startsWith('audio/') || /\.(mp3|m4a|wav|aac|ogg)$/i.test(fileName ?? ''))

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
      ) : type === 'file' ? (
        fileUrl ? (
          <div className="bubble message-file-card" role="group" aria-label={`${accessibleSender} 파일 메시지`}>
            <div className="message-file-meta">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                {isAudio ? 'audio_file' : 'description'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="message-file-name">{fileName ?? '파일'}</p>
                <p className="message-file-size">
                  {[fileType || '파일', formatFileSize(fileSize)].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            {isAudio ? (
              <audio className="message-audio-player" src={fileUrl} controls preload="metadata">
                <a href={fileUrl} target="_blank" rel="noreferrer" download={fileName}>음악 파일 열기</a>
              </audio>
            ) : (
              <a
                className="message-file-link"
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                download={fileName}
              >
                열기 / 다운로드
              </a>
            )}
          </div>
        ) : (
          <div className="bubble message-image-fallback" role="status" aria-live="polite">
            파일 전송 중...
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
