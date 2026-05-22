import { useRef, useEffect, useState, useCallback } from 'react'
import { isSameDay } from 'date-fns'
import { useApp } from '../context/AppContext'
import { useChat, ChatMessage } from '../hooks/useChat'
import { MessageBubble } from '../components/MessageBubble'
import { DateDivider } from '../components/DateDivider'
import { ChatInput } from '../components/ChatInput'
import { ImageViewer } from '../components/ImageViewer'

interface ChatScreenProps {
  onBack: () => void
}

export function ChatScreen({ onBack }: ChatScreenProps) {
  const { uid, coupleId, partnerNickname } = useApp()
  const { messages, hasMore, loading, loadMore, sendText, sendImage, markAsRead } = useChat(
    coupleId,
    uid,
  )
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)

  const partnerName = partnerNickname || '자기'

  // 신규 메시지 도착 시 자동 스크롤 (초기 로드 포함)
  useEffect(() => {
    if (messages.length === 0) return
    if (isInitialLoad.current) {
      // 초기: 즉시 바닥
      bottomRef.current?.scrollIntoView()
      isInitialLoad.current = false
    } else {
      // 신규: smooth
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  // 상단 도달 시 이전 메시지 로드 (IntersectionObserver)
  useEffect(() => {
    if (!topRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          // 스크롤 위치 보정: 로드 전 높이 기억
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

  // 같은 발신자의 연속 그룹에서 마지막 메시지인지 (시간 표시 여부)
  const isLastInGroup = useCallback(
    (index: number): boolean => {
      const next = messages[index + 1]
      if (!next) return true
      return next.senderUid !== messages[index].senderUid
    },
    [messages],
  )

  return (
    <div className="bg-[#EEE9DC] min-h-screen flex flex-col">
      {/* 헤더 */}
      <header className="w-full top-0 sticky z-50 bg-surface/80 backdrop-blur-md flex items-center px-margin-mobile py-sm gap-md">
        <button
          onClick={onBack}
          className="hover:bg-surface-container rounded-full p-xs transition-colors"
        >
          <span className="material-symbols-outlined text-primary">arrow_back</span>
        </button>

        <div className="flex items-center gap-sm flex-1">
          <div className="relative w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center overflow-hidden shrink-0">
            <span className="material-symbols-outlined text-primary">person</span>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#4CAF50] border-2 border-surface rounded-full" />
          </div>
          <div className="flex flex-col">
            <span className="font-body-md font-semibold text-primary leading-tight">{partnerName}</span>
            <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-medium">
              Active now
            </span>
          </div>
        </div>
      </header>

      {/* 메시지 목록 */}
      <main
        ref={listRef}
        className="flex-1 overflow-y-auto px-margin-mobile flex flex-col"
        style={{ paddingTop: '16px', paddingBottom: '80px' }}
      >
        {/* 상단 감시 — 여기 보이면 loadMore */}
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
            <span className="material-symbols-outlined text-[48px] text-primary/30" style={{ fontVariationSettings: "'FILL' 1" }}>
              chat_bubble
            </span>
            <p className="font-body-md text-body-md text-on-surface-variant">
              첫 메시지를 보내보세요 💕
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id}>
            {needsDivider(msg, i) && msg.createdAt && (
              <DateDivider timestamp={msg.createdAt} />
            )}
            <div className={`flex mb-xs ${msg.senderUid === uid ? 'justify-end' : 'justify-start'}`}>
              <MessageBubble
                message={msg}
                isMe={msg.senderUid === uid}
                showTime={isLastInGroup(i)}
                onImageTap={setViewerUrl}
              />
            </div>
          </div>
        ))}

        <div ref={bottomRef} className="h-1" />
      </main>

      {/* 입력창 */}
      <ChatInput onSendText={sendText} onSendImage={sendImage} />

      {/* 이미지 확대 뷰어 */}
      {viewerUrl && (
        <ImageViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
      )}
    </div>
  )
}
