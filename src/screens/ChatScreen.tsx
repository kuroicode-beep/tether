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
import { useTypingStatus } from '../hooks/useTypingStatus'
import { useOmokGame } from '../hooks/useOmokGame'
import { useGameWallet } from '../hooks/useGameWallet'
import { useOmokRecord, formatBucket } from '../hooks/useOmokRecord'
import { parseGameCommand, OMOK_HELP_TEXT, OMOK_QUICK_HINT, type GameCommand } from '../lib/gameCommand'
import { formatKrw, formatRemaining, CHARGE_AMOUNT, CHARGE_BALANCE_LIMIT } from '../lib/gameWallet'
import { OmokPanel } from '../components/OmokPanel'
import { GameBankSheet } from '../components/GameBankSheet'
import {
  formatBackground, parseRelayCommand, RELAY_HELP_TEXT, RELAY_QUICK_HINT,
} from '../lib/relayNovel'
import { RelayNovelBanner } from '../components/RelayNovelBanner'
import { RelayNovelInfoSheet } from '../components/RelayNovelInfoSheet'
import { RelayNovelReadSheet } from '../components/RelayNovelReadSheet'

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
  const { partnerTyping, notifyTyping, stopTyping } = useTypingStatus(coupleId, uid, partnerUid)
  const omok = useOmokGame(coupleId, uid, partnerUid)
  const wallet = useGameWallet(coupleId, uid)
  const omokRecord = useOmokRecord(coupleId, uid)
  const [omokExpanded, setOmokExpanded] = useState(false)
  const [bankOpen, setBankOpen] = useState(false)
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
  const [relayReadOpen, setRelayReadOpen] = useState(false)
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
  // 메시지 id → 목록 인덱스 (렌더마다 findIndex로 전체를 훑지 않도록)
  const messageIndexById = useMemo(() => {
    const map = new Map<string, number>()
    messages.forEach((m, i) => map.set(m.id, i))
    return map
  }, [messages])

  // 릴레이소설 — 시스템 안내는 진행 상황을 알리는 메시지로 남긴다
  const postRelaySystem = useCallback((text: string, novelId?: string) => {
    void sendText(text, { relayKind: 'system', relayNovelId: novelId })
  }, [sendText])

  // 게임(오목) — 시작·승패·충전 안내를 채팅에 남긴다
  const postGameSystem = useCallback((text: string, gameId?: string) => {
    void sendText(text, { gameKind: 'system', gameId })
  }, [sendText])

  // 릴레이소설 일시중지 — 상단 배너의 [중지] 버튼과 /릴소 일시중지 명령 공용
  const handleRelayPause = useCallback(async () => {
    const novel = relay.novel
    if (!novel) return
    await relay.setStatus(novel.id, 'paused')
    postRelaySystem(
      `「${novel.title}」를 일시중지했어요. 릴레이소설 서재의 [재개하기]로 언제든 이어갈 수 있고, 그동안 새 이야기를 시작해도 돼요.`,
      novel.id,
    )
  }, [relay, postRelaySystem])

  // 새 판이 시작되면 양쪽 모두 드로어를 자동으로 펼친다
  const lastSeenGameIdRef = useRef<string | null>(null)
  useEffect(() => {
    const game = omok.latestGame
    if (!game) return
    if (game.status === 'active' && lastSeenGameIdRef.current !== game.id) {
      lastSeenGameIdRef.current = game.id
      setOmokExpanded(true)
    }
  }, [omok.latestGame])

  // 드로어를 펼치면 전적을 갱신한다 (상시 리스너 없음)
  useEffect(() => {
    if (omokExpanded) void omokRecord.refresh()
  }, [omokExpanded, omokRecord])

  // 전적 4구간을 한 줄 텍스트로
  const buildRecordText = useCallback((r: typeof omokRecord.record) => [
    `${myName} 오목 전적`,
    `오늘 ${formatBucket(r.today)}`,
    `이번주 ${formatBucket(r.week)}`,
    `이번달 ${formatBucket(r.month)}`,
    `전체 ${formatBucket(r.total)}${r.total.net !== 0 ? ` (수지 ${r.total.net > 0 ? '+' : ''}${formatKrw(r.total.net)})` : ''}`,
  ].join('\n'), [myName])

  // 오목 기권 — 상대 수락 전이면 취소·환불로 처리된다
  const handleOmokSurrender = useCallback(async () => {
    const game = omok.activeGame
    if (!game) {
      postGameSystem('진행 중인 오목이 없어요. /게임 오목 으로 시작할 수 있어요.')
      return
    }
    const outcome = await omok.surrender(game)
    if (outcome === 'cancelled') {
      postGameSystem('오목 판을 취소했어요. 판돈은 돌려받았어요.', game.id)
    } else if (outcome === 'surrendered') {
      postGameSystem(
        `${myName} 기권 — ${partnerNickname || '상대방'} 승리!${game.bet > 0 ? ` 판돈 ${formatKrw(game.bet * 2)} 획득` : ''}`,
        game.id,
      )
      void omokRecord.refresh()
    }
  }, [omok, myName, partnerNickname, postGameSystem, omokRecord])

  // 초재기 30초 초과 — 시간패 (상대 수락 전이면 취소·환불)
  const handleOmokTimeout = useCallback(async () => {
    const game = omok.activeGame
    if (!game || !uid || game.nextTurnUid !== uid) return
    const outcome = await omok.surrender(game)
    if (outcome === 'cancelled') {
      postGameSystem('⏱ 30초 초과 — 오목 판을 취소했어요. 판돈은 돌려받았어요.', game.id)
    } else if (outcome === 'surrendered') {
      postGameSystem(
        `⏱ 30초 초과 — ${myName} 시간패! ${partnerNickname || '상대방'} 승리${game.bet > 0 ? ` · 판돈 ${formatKrw(game.bet * 2)} 획득` : ''}`,
        game.id,
      )
      void omokRecord.refresh()
    }
  }, [omok, uid, myName, partnerNickname, postGameSystem, omokRecord])

  // 게임 슬래시 명령 처리 (릴레이소설 명령이 아닐 때만 호출된다)
  const handleGameCommand = useCallback(async (command: GameCommand) => {
    if (command.kind === 'help') {
      postGameSystem(OMOK_HELP_TEXT)
      return
    }

    if (command.kind === 'bank') {
      setBankOpen(true)
      return
    }

    if (command.kind === 'record') {
      const r = await omokRecord.refresh()
      postGameSystem(buildRecordText(r))
      return
    }

    if (command.kind === 'charge') {
      const attempt = await wallet.charge()
      if (attempt.ok) {
        postGameSystem(`${myName} 게임머니 ${formatKrw(CHARGE_AMOUNT)} 충전 완료!`)
      } else if (attempt.reason === 'balance') {
        postGameSystem(`잔액이 ${formatKrw(CHARGE_BALANCE_LIMIT)} 이하일 때만 충전할 수 있어요 (현재 ${formatKrw(wallet.balance ?? 0)}).`)
      } else if (attempt.reason === 'daily') {
        postGameSystem('오늘 충전 3회를 모두 사용했어요. 내일 다시 충전할 수 있어요.')
      } else if (attempt.reason === 'cooldown') {
        postGameSystem(`다음 충전까지 ${formatRemaining((attempt.nextAt ?? 0) - Date.now())} 남았어요.`)
      } else {
        postGameSystem('충전에 실패했어요. 잠시 후 다시 시도해주세요.')
      }
      return
    }

    if (command.kind === 'surrender') {
      await handleOmokSurrender()
      return
    }

    // command.kind === 'start'
    if (omok.activeGame) {
      setOmokExpanded(true)
      postGameSystem('이미 진행 중인 오목이 있어요. 위 판에서 이어서 두세요.', omok.activeGame.id)
      return
    }
    const balance = wallet.balance
    if (balance == null) {
      postGameSystem('지갑을 준비하고 있어요. 잠시 후 다시 시도해주세요.')
      return
    }
    if (command.bet > 0 && balance < command.bet) {
      const eligibility = await wallet.getChargeEligibility()
      if (eligibility.ok) {
        postGameSystem(`잔액이 부족해요 (현재 ${formatKrw(balance)}). /게임 충전 으로 채운 뒤 시작해주세요.`)
      } else if (eligibility.reason === 'daily') {
        postGameSystem(`잔액이 부족하고 오늘 충전도 다 썼어요 (현재 ${formatKrw(balance)}). 내일 충전 후 시작할 수 있어요.`)
      } else {
        postGameSystem(`잔액이 부족해요 (현재 ${formatKrw(balance)}). 다음 충전까지 ${formatRemaining((eligibility.nextAt ?? 0) - Date.now())} 남아 지금은 시작할 수 없어요.`)
      }
      return
    }
    const gameId = await omok.start(command.bet)
    if (!gameId) {
      postGameSystem('오목을 시작하지 못했어요. 잠시 후 다시 시도해주세요.')
      return
    }
    setOmokExpanded(true)
    postGameSystem(
      `오목 시작! ${command.bet > 0 ? `판돈 ${formatKrw(command.bet)}` : '친선전'} · ${myName}(흑) 선공\n\n${OMOK_QUICK_HINT}`,
      gameId,
    )
  }, [omok, wallet, omokRecord, myName, postGameSystem, buildRecordText, handleOmokSurrender])

  // 보드 착수 — 첫 수면 판돈 수락, 5목·무승부면 정산까지 이어진다
  const handleOmokPlace = useCallback(async (x: number, y: number) => {
    const game = omok.activeGame
    if (!game) return
    const outcome = await omok.placeStone(game, x, y, wallet.balance)
    if (!outcome.ok) {
      if (outcome.reason === 'balance') {
        postGameSystem(`잔액이 부족해서 판돈 ${formatKrw(game.bet)}을 걸 수 없어요. 충전 후 첫 수를 두면 게임이 수락돼요.`, game.id)
        setBankOpen(true)
      }
      return
    }
    if (outcome.state === 'win') {
      postGameSystem(
        `오목 완성! ${myName} 승리 🎉${game.bet > 0 ? ` 판돈 ${formatKrw(game.bet * 2)} 획득!` : ''}`,
        game.id,
      )
      void omokRecord.refresh()
    } else if (outcome.state === 'draw') {
      postGameSystem('판이 가득 찼어요 — 무승부! 판돈은 각자 돌려받았어요.', game.id)
      void omokRecord.refresh()
    }
  }, [omok, wallet.balance, myName, postGameSystem, omokRecord])

  // 채팅 입력을 가로채 릴레이소설 명령어를 먼저 처리한다
  const handleSendText = useCallback(async (text: string) => {
    const command = parseRelayCommand(text)

    // 슬래시 명령이 아니면 언제나 평범한 대화다.
    // 릴레이소설이 진행 중이어도 일반 대화를 턴으로 삼지 않는다.
    if (!command) {
      const gameCommand = parseGameCommand(text)
      if (gameCommand) {
        await handleGameCommand(gameCommand)
        return
      }
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
            `「${command.title.trim() || relay.novel.title}」 릴레이소설을 시작했어요.\n\n${RELAY_QUICK_HINT}`,
            relay.novel.id,
          )
          return
        }
        postRelaySystem(
          `「${relay.novel.title}」를 ${relay.novel.turnCount}턴까지 쓰고 있어요. 새로 시작하려면 /릴소 완결·/릴소 일시중지·/릴소 초기화 중 하나를 써주세요.`,
          relay.novel.id,
        )
        return
      }
      const created = await relay.start(command.title)
      if (created) {
        postRelaySystem(
          `「${created.title}」 릴레이소설을 시작했어요.\n\n${RELAY_QUICK_HINT}`,
          created.id,
        )
      }
      return
    }

    if (!relay.novel) {
      postRelaySystem('진행 중인 릴레이소설이 없어요. /릴레이소설 시작 으로 열어주세요.')
      return
    }

    // 보기·제목·배경·초기화는 차례와 무관하게 둘 다 언제든 쓸 수 있다
    if (command.kind === 'view') {
      if (relay.novel.turns.length === 0) {
        postRelaySystem('아직 쓴 내용이 없어요. /릴소 쓰기 로 첫 문장을 시작해보세요.', relay.novel.id)
        return
      }
      setRelayReadOpen(true)
      return
    }

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

    // 쓰기·이어쓰기 도움은 지금 차례인 사람만 쓸 수 있다 (일시중지는 둘 다 언제든)
    if ((command.kind === 'write' || command.kind === 'assist') && !isMyTurn) {
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
      await handleRelayPause()
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
    isMyTurn, nextTurnUid, turnOwnerName, handleGameCommand, handleRelayPause,
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

  // "이전 내용 보기" 버튼 — 이전 메시지를 불러오고 보던 위치를 유지한다
  const handleLoadPrevious = useCallback(() => {
    const list = listRef.current
    if (!list || !hasMore || loading) return

    const prevHeight = list.scrollHeight
    const prevTop = list.scrollTop
    void loadMore().then(() => {
      const nextList = listRef.current
      if (!nextList) return
      const added = nextList.scrollHeight - prevHeight
      nextList.scrollTop = prevTop + Math.max(added, 0)
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
      if (!msg.createdAt || index < 0) return false
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
          onPause={() => void handleRelayPause()}
        />
      )}

      {omok.latestGame && (
        omok.latestGame.status === 'active'
        || (omok.latestGame.finishedAt != null && Date.now() - omok.latestGame.finishedAt < 30 * 60_000)
      ) && (
        <OmokPanel
          game={omok.latestGame}
          myUid={uid}
          myName={myName}
          partnerName={partnerName}
          balance={wallet.balance}
          record={omokRecord.record}
          expanded={omokExpanded}
          onToggleExpanded={() => setOmokExpanded((v) => !v)}
          onPlace={handleOmokPlace}
          onSurrender={() => void handleOmokSurrender()}
          onOpenBank={() => setBankOpen(true)}
          onTimeout={handleOmokTimeout}
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
          onOpenRead={() => { setRelayInfoOpen(false); setRelayReadOpen(true) }}
          onClose={() => setRelayInfoOpen(false)}
        />
      )}

      {relay.novel && relayReadOpen && (
        <RelayNovelReadSheet novel={relay.novel} onClose={() => setRelayReadOpen(false)} />
      )}

      <main
        ref={listRef}
        className="chat-message-list flex-1 min-h-0 overflow-y-auto px-4 flex flex-col"
        style={{ paddingTop: '16px', paddingBottom: '12px' }}
      >
        <div ref={topRef} className="shrink-0">
          {hasMore && (
            <div className="flex justify-center pb-sm">
              <button
                type="button"
                className="chat-load-previous"
                onClick={handleLoadPrevious}
                disabled={loading}
              >
                {loading ? '불러오는 중…' : '이전 내용 보기'}
              </button>
            </div>
          )}
          {!hasMore && loading && (
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
                const flatIndex = messageIndexById.get(msg.id) ?? -1
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

      <div className="chat-input-wrap">
        {partnerTyping && (
          <div className="typing-indicator" role="status" aria-live="polite">
            <span className="typing-indicator-text">{partnerName} 입력 중</span>
            <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
          </div>
        )}
        <ChatInput
          onSendText={handleSendText}
          onSendFile={sendFile}
          autoFocus
          incomingFiles={incomingFiles}
          onFocusChange={(focused) => { inputFocusedRef.current = focused }}
          onTyping={notifyTyping}
          onTypingStop={stopTyping}
        />
      </div>

      {bankOpen && (
        <GameBankSheet
          coupleId={coupleId}
          myUid={uid}
          balance={wallet.balance}
          onCharge={wallet.charge}
          onClose={() => setBankOpen(false)}
        />
      )}

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
