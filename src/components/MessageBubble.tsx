import { ChatMessage } from '../hooks/useChat'

interface MessageBubbleProps {
  message: ChatMessage
  isMe: boolean
  showTime: boolean
  onImageTap?: (url: string) => void
}

function formatTime(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export function MessageBubble({ message, isMe, showTime, onImageTap }: MessageBubbleProps) {
  const { type, text, imageUrl, createdAt, readBy, senderUid } = message
  const isRead = !isMe ? false : readBy.filter((u) => u !== senderUid).length > 0

  return (
    <div className={`flex flex-col max-w-[75%] gap-xs ${isMe ? 'items-end self-end ml-auto' : 'items-start self-start mr-auto'}`}>
      {/* 버블 */}
      {type === 'text' ? (
        <div
          className={`px-md py-sm rounded-[18px] shadow-sm leading-relaxed ${
            isMe
              ? 'bg-primary text-on-primary rounded-br-sm'
              : 'bg-surface-container text-on-surface rounded-bl-sm'
          }`}
        >
          <p className="font-body-md text-body-md whitespace-pre-wrap break-words">{text}</p>
        </div>
      ) : imageUrl ? (
        <button
          onClick={() => onImageTap?.(imageUrl)}
          className="rounded-[18px] overflow-hidden shadow-sm active:scale-95 transition-transform"
        >
          <img
            src={imageUrl}
            alt="이미지 메시지"
            className="max-w-[220px] max-h-[300px] object-cover block"
            loading="lazy"
          />
        </button>
      ) : null}

      {/* 시간 + 읽음 */}
      {showTime && (
        <div className={`flex items-center gap-xs ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[10px] text-on-surface-variant opacity-70">
            {formatTime(createdAt)}
          </span>
          {isMe && (
            <span
              className={`material-symbols-outlined text-[12px] ${isRead ? 'text-primary' : 'text-outline-variant'}`}
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
