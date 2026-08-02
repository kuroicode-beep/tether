import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { isSameDay } from 'date-fns'
import { useApp } from '../context/useApp'
import { useCoupleSession } from '../hooks/useCoupleSession'
import { useChat, ChatMessage } from '../hooks/useChat'
import { usePhotos } from '../hooks/usePhotos'
import { ContentActionSheet } from '../components/ContentActionSheet'
import { MessageBubble } from '../components/MessageBubble'
import { DateDivider } from '../components/DateDivider'
import { ChatInput } from '../components/ChatInput'
import { ImageViewer } from '../components/ImageViewer'
import { ProfileAvatar } from '../components/ProfileAvatar'
import { useKeyboardInset } from '../hooks/useKeyboardInset'
import { useRelayNovel } from '../hooks/useRelayNovel'
import { formatBackground, parseRelayCommand, RELAY_HELP_TEXT } from '../lib/relayNovel'
import { RelayNovelBanner } from '../components/RelayNovelBanner'
import { RelayNovelInfoSheet } from '../components/RelayNovelInfoSheet'

interface ChatScreenProps {
  onBack: () => void
  onSetThemeTrack?: (track: { title: string; url: string }) => void
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

export function ChatScreen({ onBack, onSetThemeTrack }: ChatScreenProps) {
  const { uid, coupleId } = useCoupleSession()
  const { partnerNickname, partnerUid, myPhotoUrl, partnerPhotoUrl, myNickname } = useApp()
  const { messages, hasMore, loading, loadMore, sendText, sendFile, markManyAsRead, updateMessage, deleteMessage } = useChat(
    coupleId,
    uid,
  )
  const { addPhotoFromUrl } = usePhotos(coupleId, uid, partnerUid)
  const relay = useRelayNovel(coupleId, uid)
  const keyboardOpen = useKeyboardInset()
  const myName = myNickname || '나'

  // 릴레이소설 턴 규칙 — 한 턴씩 번갈아 쓴다
  const isMyTurn = !!relay.novel && !!uid && relay.novel.nextTurnUid === uid
  const nextTurnUid = (uid && relay.novel?.nextTurnUid === uid ? partnerUid : uid) ?? uid ?? ''
  const turnOwnerName = relay.novel
    ? (relay.novel.nextTurnUid === uid ? myName : partnerNickname || '상대방')
    : ''
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [relayInfoOpen, setRelayInfoOpen] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [incomingFiles, setIncomingFiles] = useState<{ id: number; files: File[] } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const isInitialLoadRef = useRef(true)
  const initialScrollDoneRef = useRef(false)
  const lastMessageIdRef = useRef<string | null>(null)
  const inputFocusedRef = useRef(false)
  const markingReadRef = useRef<Set<string>>(new Set())
  const dragDepthRef = useRef(0)

  const partnerName = partnerNickname || '자기'
  const groupedMessages = useMemo(() => groupMessages(messages), [messages])

  // 릴레이소설 — 시스템 안내는 진행 상황을 알리는 메시지로 남긴다
  const postRelaySystem = useCallback((text: string, novelId?: string) => {
    void sendText(text, { relayKind: 'system', relayNovelId: novelId })
  }, [sendText])

  // 채팅 입력을 가로채 릴레이소설 명령어를 먼저 처리한다
  const handleSendText = useCallback(async (text: string) => {
    const command = parseRelayCommand(text)

    // 슬래시 명령이 아니면 언제나 평범한 대화다.
    // 릴레이소설이 진행 중이어도 일반 대화를 턴으로 삼지 않는다.
    if (!command) {
      await sendText(text)
      return
    }

    if (command.kind === 'help') {
      postRelaySystem(RELAY_HELP_TEXT)
      return
    }

    if (command.kind === 'start') {
      if (relay.novel) {
        // 아직 한 턴도 쓰지 않은 세션이면 새로 시작한 것으로 본다 (제목만 다시 정한다)
        if (relay.novel.turnCount === 0) {
          if (command.title.trim()) await relay.setTitle(relay.novel.id, command.title)
          if (relay.novel.status !== 'active') await relay.setStatus(relay.novel.id, 'active')
          postRelaySystem(
            `「${command.title.trim() || relay.novel.title}」 릴레이소설을 시작했어요. /릴소 쓰기 로 첫 turn을 써주세요.`,
            relay.novel.id,
          )
          return
        }
        postRelaySystem(
          relay.novel.status === 'paused'
            ? `「${relay.novel.title}」가 ${relay.novel.turnCount}턴에서 멈춰 있어요. /릴소 쓰기 로 이어집니다.`
            : `「${relay.novel.title}」를 ${relay.novel.turnCount}턴까지 쓰고 있어요. 새로 시작하려면 /릴소 완결 이나 /릴소 초기화 를 써주세요.`,
          relay.novel.id,
        )
        return
      }
      const created = await relay.start(command.title)
      if (created) postRelaySystem(`「${created.title}」 릴레이소설을 시작했어요.`, created.id)
      return
    }

    if (!relay.novel) {
      postRelaySystem('진행 중인 릴레이소설이 없어요. /릴레이소설 시작 으로 열어주세요.')
      return
    }

    // 제목·배경·초기화는 차례와 무관하게 둘 다 언제든 쓸 수 있다
    if (command.kind === 'title') {
      await relay.setTitle(relay.novel.id, command.title)
      postRelaySystem(
        command.title.trim()
          ? `제목을 「${command.title.trim()}」로 바꿨어요.`
          : '제목을 지웠어요.',
        relay.novel.id,
      )
      return
    }

    if (command.kind === 'background') {
      if (!command.text.trim()) {
        postRelaySystem(`설정\n${formatBackground(relay.novel.background)}`, relay.novel.id)
        return
      }
      const added = await relay.addBackground(relay.novel.id, command.text, myName)
      if (added) {
        postRelaySystem(
          `설정을 더했어요.\n${relay.novel.background.length + 1}. ${added.text}`,
          relay.novel.id,
        )
      }
      return
    }

    if (command.kind === 'backgroundRemove') {
      const target = relay.novel.background[command.index - 1]
      if (!target) {
        postRelaySystem(
          `${command.index}번 설정이 없어요.\n${formatBackground(relay.novel.background)}`,
          relay.novel.id,
        )
        return
      }
      await relay.removeBackground(relay.novel.id, relay.novel.background, target.id)
      postRelaySystem(`${command.index}번 설정을 지웠어요. (${target.text})`, relay.novel.id)
      return
    }

    if (command.kind === 'reset') {
      const result = await relay.voteReset(relay.novel, uid ?? '', partnerUid)
      postRelaySystem(
        result === 'done'
          ? '릴레이소설을 초기화했어요. /릴소 시작 으로 새 이야기를 열 수 있어요.'
          : `초기화에 동의했어요. ${partnerNickname || '상대방'}도 /릴레이소설 초기화 를 입력하면 비워집니다.`,
        relay.novel.id,
      )
      return
    }

    // 쓰기·멈추기·이어쓰기 도움은 지금 차례인 사람만 쓸 수 있다
    if ((command.kind === 'write' || command.kind === 'pause' || command.kind === 'assist') && !isMyTurn) {
      postRelaySystem(`지금은 ${turnOwnerName} 차례예요. 차례인 사람만 쓸 수 있어요.`, relay.novel.id)
      return
    }

    if (command.kind === 'write') {
      const body = command.text.trim()
      if (!body) {
        postRelaySystem('쓸 내용을 함께 적어주세요. 예) /릴레이소설 쓰기 비가 그쳤다', relay.novel.id)
        return
      }
      if (relay.novel.status === 'paused') {
        await relay.setStatus(relay.novel.id, 'active')
      }
      const turnNumber = relay.novel.turnCount + 1
      await sendText(body, {
        relayKind: 'turn',
        relayNovelId: relay.novel.id,
        relayTurn: turnNumber,
        relayAuthorName: myName,
      })
      await relay.appendTurn(relay.novel.id, {
        authorUid: uid ?? '',
        authorName: myName,
        text: body,
        at: Date.now(),
      }, nextTurnUid)
      return
    }

    if (command.kind === 'pause') {
      await relay.setStatus(relay.novel.id, 'paused')
      postRelaySystem(`「${relay.novel.title}」를 잠시 멈췄어요. 이어서 쓰려면 그냥 쓰면 돼요.`, relay.novel.id)
      return
    }

    if (command.kind === 'complete') {
      await relay.setStatus(relay.novel.id, 'completed')
      postRelaySystem(
        `「${relay.novel.title}」 완결! ${relay.novel.turnCount}턴으로 마무리했어요. 릴레이소설 서재에 보관했어요.`,
        relay.novel.id,
      )
      return
    }

    // command.kind === 'assist'
    if (relay.novel.turns.length === 0) {
      postRelaySystem('아직 이야기가 없어요. 첫 문장을 먼저 써주세요.', relay.novel.id)
      return
    }
    try {
      const suggestion = await relay.requestAssist(relay.novel)
      const turnNumber = relay.novel.turnCount + 1
      await sendText(suggestion, {
        relayKind: 'assist',
        relayNovelId: relay.novel.id,
        relayTurn: turnNumber,
        relayAuthorName: '이어쓰기 도움',
      })
      await relay.appendTurn(relay.novel.id, {
        authorUid: uid ?? '',
        authorName: '이어쓰기 도움',
        text: suggestion,
        at: Date.now(),
        bySidekick: true,
      }, nextTurnUid)
    } catch (err) {
      console.warn('[ChatScreen] relay assist failed', err)
      postRelaySystem('이어쓰기 도움을 불러오지 못했어요. 잠시 후 다시 시도해주세요.', relay.novel.id)
    }
  }, [
    relay, sendText, postRelaySystem, myName, uid, partnerUid, partnerNickname,
    isMyTurn, nextTurnUid, turnOwnerName,
  ])

  // 릴레이소설 턴 메시지를 지우면 소설에서도 그 턴을 되돌린다.
  // 메시지만 지우고 턴이 그대로 소모되면 차례를 잃는다.
  const handleDeleteMessage = useCallback(async (msg: ChatMessage) => {
    const isRelayTurn = msg.relayKind === 'turn' || msg.relayKind === 'assist'
    const belongsToCurrent = isRelayTurn && relay.novel && msg.relayNovelId === relay.novel.id

    if (belongsToCurrent && relay.novel) {
      await relay.removeTurn(relay.novel, msg.senderUid, msg.text ?? '')
    }
    await deleteMessage(msg.id)
  }, [relay, deleteMessage])

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

  // 키보드가 열리고 닫히는 순간에만 마지막 메시지 위치를 맞춘다 (입력 중 재정렬 방지)
  useEffect(() => {
    if (!initialScrollDoneRef.current) return
    requestAnimationFrame(() => scrollToBottom('auto'))
  }, [keyboardOpen, scrollToBottom])

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

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!event.dataTransfer.types.includes('Files')) return
    dragDepthRef.current += 1
    setDragActive(true)
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setDragActive(false)
  }, [])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = 0
    setDragActive(false)
    const files = Array.from(event.dataTransfer.files ?? [])
    if (files.length === 0) return
    setIncomingFiles({ id: Date.now(), files })
  }, [])

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files ?? [])
    if (files.length === 0) return
    event.preventDefault()
    setIncomingFiles({ id: Date.now(), files })
  }, [])

  return (
    <div
      className="chat-screen flex flex-col"
      style={{ background: 'var(--color-bg)' }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-[80] flex items-center justify-center bg-black/45 px-margin-mobile">
          <div className="hc-readable-box rounded-2xl border-2 border-dashed border-white bg-black px-xl py-lg text-center text-white shadow-2xl">
            <span className="material-symbols-outlined mb-sm text-4xl">upload_file</span>
            <p className="font-label-md text-label-md font-semibold">파일을 놓으면 채팅에 첨부돼요</p>
            <p className="mt-xs font-label-sm text-label-sm opacity-80">이미지, 음악, 문서, zip 파일을 보낼 수 있어요.</p>
          </div>
        </div>
      )}
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

      {relay.novel && (
        <RelayNovelBanner
          novel={relay.novel}
          assisting={relay.assisting}
          turnOwnerName={turnOwnerName}
          isMyTurn={isMyTurn}
          onOpenInfo={() => setRelayInfoOpen(true)}
        />
      )}

      {relay.novel && relayInfoOpen && (
        <RelayNovelInfoSheet
          novel={relay.novel}
          turnOwnerName={turnOwnerName}
          isMyTurn={isMyTurn}
          onRemoveBackground={(noteId) => {
            if (!relay.novel) return
            void relay.removeBackground(relay.novel.id, relay.novel.background, noteId)
          }}
          onClose={() => setRelayInfoOpen(false)}
        />
      )}

      <main
        ref={listRef}
        className="chat-message-list flex-1 min-h-0 overflow-y-auto px-4 flex flex-col"
        style={{ paddingTop: '16px', paddingBottom: '12px' }}
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
                    onSetThemeTrack={onSetThemeTrack}
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
                          onDelete={() => handleDeleteMessage(msg)}
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
        onSendText={handleSendText}
        onSendFile={sendFile}
        autoFocus
        incomingFiles={incomingFiles}
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
