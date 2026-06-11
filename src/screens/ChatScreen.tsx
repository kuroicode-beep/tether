import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { isSameDay } from 'date-fns'
import { useApp } from '../context/AppContext'
import { useCoupleSession } from '../hooks/useCoupleSession'
import { useChat, ChatMessage } from '../hooks/useChat'
import { usePhotos } from '../hooks/usePhotos'
import { ContentActionSheet } from '../components/ContentActionSheet'
import { MessageBubble } from '../components/MessageBubble'
import { DateDivider } from '../components/DateDivider'
import { ChatInput } from '../components/ChatInput'
import { ImageViewer } from '../components/ImageViewer'
import { ProfileAvatar } from '../components/ProfileAvatar'

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
  const { uid, coupleId } = useCoupleSession()
  const { partnerNickname, partnerUid, myPhotoUrl, partnerPhotoUrl, myNickname } = useApp()
  const { messages, hasMore, loading, loadMore, sendText, sendImage, markManyAsRead, updateMessage, deleteMessage } = useChat(
    coupleId,
    uid,
  )
  const { addPhotoFromUrl } = usePhotos(coupleId, uid, partnerUid)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const isInitialLoadRef = useRef(true)
  const initialScrollDoneRef = useRef(false)
  const lastMessageIdRef = useRef<string | null>(null)
  const inputFocusedRef = useRef(false)
  const markingReadRef = useRef<Set<string>>(new Set())

  const partnerName = partnerNickname || '자기'
  const groupedMessages = useMemo(() => groupMessages(messages), [messages])

  const handleSendToAlbum = useCallback(async () => {
    if (!viewerUrl) return
    await addPhotoFromUrl(viewerUrl, '채팅에서 저장한 사진')
    setViewerUrl(null)
  }, [addPhotoFromUrl, viewerUrl])

  // 메시지 목록 맨 아래로 스크롤한다
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const list = listRef.current
    if (!list) return
    list.scrollTo({ top: list.scrollHeight, behavior })
  }, [])

  // 초기 진입·전송·상대 메시지 수신 시 맨 아래로 스크롤 (이전 메시지 로드는 제외)
  useEffect(() => {
    if (messages.length === 0) return

    const lastId = messages[messages.length - 1]?.id
    if (!lastId) return

    const runScroll = (behavior: ScrollBehavior, afterScroll?: () => void) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(behavior)
          afterScroll?.()
        })
      })
    }

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      lastMessageIdRef.current = lastId
      initialScrollDoneRef.current = false
      runScroll('auto', () => {
        initialScrollDoneRef.current = true
      })
      return
    }

    if (lastMessageIdRef.current === lastId) return

    lastMessageIdRef.current = lastId
    const behavior = inputFocusedRef.current ? 'auto' : 'smooth'
    runScroll(behavior)
  }, [messages, scrollToBottom])

  // 사용자가 직접 맨 위에 닿았을 때만 이전 메시지를 불러온다 (iOS 자동 튐 방지)
  const handleListScroll = useCallback(() => {
    const list = listRef.current
    if (!list || !initialScrollDoneRef.current || inputFocusedRef.current) return
    if (!hasMore || loading || list.scrollTop > 24) return

    const prevHeight = list.scrollHeight
    void loadMore().then(() => {
      const nextList = listRef.current
      if (!nextList) return
      const added = nextList.scrollHeight - prevHeight
      nextList.scrollTop = Math.max(added, 0)
    })
  }, [hasMore, loading, loadMore])

  // 상대방 메시지 읽음 처리 (중복 write 방지)
  useEffect(() => {
    if (!uid) return
    const unreadIds = messages
      .filter(
        (msg) =>
          msg.senderUid !== uid &&
          !msg.readBy.includes(uid) &&
          !markingReadRef.current.has(msg.id),
      )
      .map((msg) => msg.id)
    if (unreadIds.length === 0) return

    unreadIds.forEach((id) => markingReadRef.current.add(id))
    markManyAsRead(unreadIds).finally(() => {
      unreadIds.forEach((id) => markingReadRef.current.delete(id))
    })
  }, [messages, uid, markManyAsRead])

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
    <div
      className="screen flex flex-col overflow-hidden"
      style={{ background: 'var(--color-bg)', height: '100dvh' }}
    >
      <header className="chat-header">
        <button type="button" onClick={onBack} className="back-btn" aria-label="뒤로">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>

        <div className="avatar">
          <ProfileAvatar src={partnerPhotoUrl} name={partnerName} size="md" />
          <span className="online-dot" />
        </div>

        <div className="info flex flex-col">
          <span className="name">{partnerName}</span>
          <span className="status">Active now</span>
        </div>
      </header>

      <main
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 flex flex-col"
        style={{ paddingTop: '16px', paddingBottom: '80px' }}
        onScroll={handleListScroll}
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
                    <div className={`message-row flex items-end gap-xs ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && <ProfileAvatar src={partnerPhotoUrl} name={partnerName} size="sm" />}
                      {isMe && msg.type === 'text' ? (
                        <ContentActionSheet
                          enabled
                          wrapperClassName="message-action-wrap"
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
                      {isMe && <ProfileAvatar src={myPhotoUrl} name={myNickname} size="sm" />}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}

        <div ref={bottomRef} className="h-1" />
      </main>

      <ChatInput
        onSendText={sendText}
        onSendImage={sendImage}
        onFocusChange={(focused) => { inputFocusedRef.current = focused }}
      />

      {viewerUrl && (
        <ImageViewer
          url={viewerUrl}
          onClose={() => setViewerUrl(null)}
          actionLabel="사진첩으로 보내기"
          actionButtonLabel="보내기"
          onAction={handleSendToAlbum}
        />
      )}
    </div>
  )
}
