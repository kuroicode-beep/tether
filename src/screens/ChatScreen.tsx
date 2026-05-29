import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { isSameDay } from 'date-fns'
import { useApp } from '../context/AppContext'
import { useChat, ChatMessage } from '../hooks/useChat'
import { ContentActionSheet } from '../components/ContentActionSheet'
import { useUnreadBadges } from '../hooks/useUnreadBadges'
import { MessageBubble } from '../components/MessageBubble'
import { DateDivider } from '../components/DateDivider'
import { ChatInput } from '../components/ChatInput'
import { ImageViewer } from '../components/ImageViewer'

interface ChatScreenProps {
  onBack: () => void
}

// 연속된 동일 발신자 메시지를 1분 단위로 그룹화
function groupMessages(messages: ChatMessage[]): ChatMessage[][] {
  return messages.reduce<ChatMessage[][]>((groups, msg, i) => {
    const prev = messages[i - 1]
    const isSameSender = prev?.senderUid === msg.senderUid
    const isSameMinute =
      prev?.createdAt != null &&
      msg.createdAt != null &&
      Math.abs(msg.createdAt - prev.createdAt) < 60_000

    if (isSameSender && isSameMinute) {
      groups[groups.length - 1].push(msg)
    } else {
      groups.push([msg])
    }
    return groups
  }, [])
}

export function ChatScreen({ onBack }: ChatScreenProps) {
  const { uid, coupleId, partnerNickname } = useApp()
  const { messages, hasMore, loading, loadMore, sendText, sendImage, markAsRead, updateMessage, deleteMessage } = useChat(
    coupleId,
    uid,
  )
  const { markTabRead } = useUnreadBadges(coupleId, uid)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)

  const partnerName = partnerNickname || '자기'
  const groupedMessages = useMemo(() => groupMessages(messages), [messages])

  // 채팅 탭 진입 시 미읽음 배지 해제
  useEffect(() => {
    markTabRead('chat')
  }, [coupleId, uid, markTabRead])

  // 신규 메시지 도착 시 자동 스크롤 (초기 로드 포함)
  useEffect(() => {
    if (messages.length === 0) return
    if (isInitialLoad.current) {
      bottomRef.current?.scrollIntoView()
      isInitialLoad.current = false
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  // 상단 도달 시 이전 메시지 로드 (IntersectionObserver)
  useEffect(() => {
    if (!topRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          const list = listRef.current
          const prevHeight = list?.scrollHeight ?? 0
          loadMore().then(() => {
            if (list) {
              const added = list.scrollHeight - prevHeight
              list.scrollTop = added
            }
          })
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(topRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadMore])

  // 상대방 메시지 읽음 처리
  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.senderUid !== uid && !msg.readBy.includes(uid ?? '')) {
        markAsRead(msg.id)
      }
    })
  }, [messages, uid, markAsRead])

  // 메시지 사이에 날짜 디바이더가 필요한지 판단
  const needsDivider = useCallback(
    (msg: ChatMessage, index: number): boolean => {
      if (!msg.createdAt) return false
      if (index === 0) return true
      const prev = messages[index - 1]
      if (!prev.createdAt) return false
      return !isSameDay(new Date(prev.createdAt), new Date(msg.createdAt))
    },
    [messages],
  )

  return (
    <div className="screen min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <header className="chat-header">
        <button type="button" onClick={onBack} className="back-btn" aria-label="뒤로">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>

        <div className="avatar">
          <span className="material-symbols-outlined text-primary">person</span>
          <span className="online-dot" />
        </div>

        <div className="info flex flex-col">
          <span className="name">{partnerName}</span>
          <span className="status">Active now</span>
        </div>
      </header>

      <main
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 flex flex-col"
        style={{ paddingTop: '16px', paddingBottom: '80px' }}
      >
        <div ref={topRef} className="h-1 shrink-0">
          {loading && (
            <div className="flex justify-center py-sm">
              <span className="material-symbols-outlined text-outline-variant animate-spin text-sm">
                progress_activity
              </span>
            </div>
          )}
        </div>

        {messages.length === 0 && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-sm text-center py-xxl">
            <span
              className="material-symbols-outlined text-[48px] opacity-30 text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              chat_bubble
            </span>
            <p className="font-body-md text-body-md opacity-60" style={{ color: 'var(--color-text-muted)' }}>
              첫 메시지를 보내보세요 💕
            </p>
          </div>
        )}

        {groupedMessages.map((group, groupIndex) => {
          const prevGroup = groupedMessages[groupIndex - 1]
          const isNewSender =
            groupIndex === 0 || prevGroup?.[0]?.senderUid !== group[0].senderUid

          return (
            <div
              key={group.map((m) => m.id).join('-')}
              className={`message-group${isNewSender ? ' new-sender' : ''}`}
            >
              {group.map((msg, msgIndex) => {
                const flatIndex = messages.findIndex((m) => m.id === msg.id)
                const isMe = msg.senderUid === uid
                const showSenderName = msgIndex === 0 && !isMe
                const showTime = msgIndex === group.length - 1

                const bubble = (
                  <MessageBubble
                    message={msg}
                    isMe={isMe}
                    showTime={showTime}
                    showSenderName={showSenderName}
                    senderName={partnerName}
                    onImageTap={setViewerUrl}
                  />
                )

                return (
                  <div key={msg.id}>
                    {needsDivider(msg, flatIndex) && msg.createdAt && (
                      <DateDivider timestamp={msg.createdAt} />
                    )}
                    <div className={`message-row flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {isMe && msg.type === 'text' ? (
                        <ContentActionSheet
                          enabled
                          onEdit={() => {
                            const next = window.prompt('메시지 수정', msg.text ?? '')
                            if (next?.trim()) updateMessage(msg.id, next)
                          }}
                          onDelete={() => deleteMessage(msg.id)}
                        >
                          {bubble}
                        </ContentActionSheet>
                      ) : (
                        bubble
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}

        <div ref={bottomRef} className="h-1" />
      </main>

      <ChatInput onSendText={sendText} onSendImage={sendImage} />

      {viewerUrl && (
        <ImageViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
      )}
    </div>
  )
}
