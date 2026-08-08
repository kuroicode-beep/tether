// src/components/MessageBubble.tsx
// Renders one chat bubble with sender name, media fallback, and read state.
import { memo, useEffect, useState } from 'react'
import { ChatMessage } from '../hooks/useChat'

interface MessageBubbleProps {
  message: ChatMessage
  isMe: boolean
  showTime: boolean
  showSenderName?: boolean
  senderName?: string
  onImageTap?: (url: string) => void
  onSetThemeTrack?: (track: { title: string; url: string }) => void
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

// Splits chat text into plain text and clickable http(s) URL segments.
function renderTextWithLinks(text: string) {
  const urlPattern = /https?:\/\/[^\s<>"']+/gi
  const parts: Array<string | JSX.Element> = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = urlPattern.exec(text)) !== null) {
    const rawUrl = match[0]
    const trailing = rawUrl.match(/[),.!?;:]+$/)?.[0] ?? ''
    const cleanUrl = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl
    const start = match.index

    if (start > lastIndex) parts.push(text.slice(lastIndex, start))
    parts.push(
      <a
        key={`${cleanUrl}-${start}`}
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="message-text-link"
      >
        {cleanUrl}
      </a>,
    )
    if (trailing) parts.push(trailing)
    lastIndex = start + rawUrl.length
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? parts : text
}

// 메시지 내용이 바뀌지 않으면 다시 그리지 않는다 (목록 전체 리렌더 방지)
export const MessageBubble = memo(function MessageBubble({
  message,
  isMe,
  showTime,
  showSenderName = false,
  senderName,
  onImageTap,
  onSetThemeTrack,
}: MessageBubbleProps) {
  const {
    type, text, imageUrl, fileUrl, fileName, fileType, fileSize, createdAt, readBy, senderUid,
    relayKind, relayTurn, relayAuthorName, gameKind,
  } = message
  const [imgError, setImgError] = useState(false)
  const isRead = isMe && readBy.filter((uid) => uid !== senderUid).length > 0
  const timeText = formatTime(createdAt)
  const accessibleSender = isMe ? '내가 보낸' : `${senderName ?? '상대방'}이 보낸`
  const caption = type === 'text' ? '' : (text ?? '').trim()
  const accessibleContent = type === 'image'
    ? (imgError ? '불러올 수 없는 사진 메시지' : `사진 메시지${caption ? `, ${caption}` : ''}`)
    : type === 'file'
      ? `${fileName ?? '파일'} 파일 메시지${caption ? `, ${caption}` : ''}`
    : (text || '빈 메시지')
  const accessibilityLabel = `${accessibleSender} 메시지${timeText ? `, ${timeText}` : ''}, ${accessibleContent}`
  const isAudio = type === 'file' && (fileType?.startsWith('audio/') || /\.(mp3|m4a|wav|aac|ogg)$/i.test(fileName ?? ''))
  const showUnreadMarker = isMe && !isRead

  useEffect(() => {
    setImgError(false)
  }, [imageUrl])

  // 게임(오목) 안내 — 릴레이소설 안내와 같은 카드 스타일, 아이콘만 게임패드
  if (gameKind === 'system') {
    return (
      <div className="relay-system" role="note">
        <span className="material-symbols-outlined relay-system-icon" aria-hidden="true">
          sports_esports
        </span>
        <p className="relay-system-text">{text}</p>
      </div>
    )
  }

  // 릴레이소설 안내 — 발신자와 무관하게 가운데 정렬된 안내 카드로 보여준다
  if (relayKind === 'system') {
    return (
      <div className="relay-system" role="note">
        <span className="material-symbols-outlined relay-system-icon" aria-hidden="true">
          history_edu
        </span>
        <p className="relay-system-text">{text}</p>
      </div>
    )
  }

  // 릴레이소설 한 턴 — 원고 카드로 일반 말풍선과 확실히 구분한다
  if (relayKind === 'turn' || relayKind === 'assist') {
    const byAssist = relayKind === 'assist'
    return (
      <div
        className={`relay-turn${byAssist ? ' relay-turn--assist' : ''}${isMe ? ' relay-turn--mine' : ''}`}
        aria-label={`릴레이소설 ${relayTurn ?? ''}번째 turn, ${relayAuthorName ?? senderName ?? ''}`}
      >
        <div className="relay-turn-head">
          <span className="relay-turn-number">{relayTurn ?? '-'}</span>
          <span className="relay-turn-author">
            {relayAuthorName ?? (isMe ? '나' : senderName ?? '상대방')}
          </span>
          {byAssist && <span className="relay-turn-tag">이어쓰기 도움</span>}
        </div>
        <p className="relay-turn-text">{text}</p>
        {timeText && <span className="relay-turn-time">{timeText}</span>}
      </div>
    )
  }

  return (
    <div className={isMe ? 'message-mine' : 'message-partner'} aria-label={accessibilityLabel}>
      {!isMe && showSenderName && senderName && (
        <span className="sender-name">{senderName}</span>
      )}

      {type === 'text' ? (
        <div className="bubble" role="text">{renderTextWithLinks(text ?? '')}</div>
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
              alt={caption || `${accessibleSender} 사진 메시지`}
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
              <>
                <audio className="message-audio-player" src={fileUrl} controls preload="metadata">
                  <a href={fileUrl} target="_blank" rel="noreferrer" download={fileName}>음악 파일 열기</a>
                </audio>
                {onSetThemeTrack && (
                  <button
                    type="button"
                    className="message-theme-button"
                    onClick={() => onSetThemeTrack({ title: fileName ?? 'Tether theme', url: fileUrl })}
                  >
                    메인테마로 지정
                  </button>
                )}
              </>
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

      {caption && (
        <div className="bubble message-attachment-caption" role="text">
          {renderTextWithLinks(caption)}
        </div>
      )}

      {(showTime || showUnreadMarker) && (
        <div className="message-time" aria-hidden="true">
          {showTime && <span>{timeText}</span>}
          {showUnreadMarker && (
            <span
              className="message-unread-icon material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 0" }}
              title="상대가 아직 읽지 않음"
            >
              done
            </span>
          )}
        </div>
      )}
    </div>
  )
}, (prev, next) => {
  // 스냅샷마다 메시지 객체가 새로 생성되므로 내용으로 비교한다
  const a = prev.message
  const b = next.message
  return prev.isMe === next.isMe
    && prev.showTime === next.showTime
    && prev.showSenderName === next.showSenderName
    && prev.senderName === next.senderName
    && prev.onImageTap === next.onImageTap
    && prev.onSetThemeTrack === next.onSetThemeTrack
    && a.id === b.id
    && a.text === b.text
    && a.imageUrl === b.imageUrl
    && a.fileUrl === b.fileUrl
    && a.createdAt === b.createdAt
    && a.readBy.join(',') === b.readBy.join(',')
})
