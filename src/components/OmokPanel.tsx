// src/components/OmokPanel.tsx
// 채팅 상단 오목 드로어 — 접힘=한 줄 배너, 펼침=보드+상태+전적 (채팅과 동시 사용)
// 내 차례 30초 초재기 + 효과음 + 상대 마지막 수 반짝임 포함.
import { useState, useCallback, useEffect, useRef } from 'react'
import { OmokGame, formatCoord } from '../lib/omok'
import { formatKrw } from '../lib/gameWallet'
import { OmokBoard } from './OmokBoard'
import { OmokRecord, formatBucket } from '../hooks/useOmokRecord'
import { playStoneSound, playTickSound, playTimeoutSound, playWinSound } from '../lib/omokSound'

// 초재기 — 내 차례가 되면 30초 안에 둔다 (화면이 보일 때만 흐른다)
const TURN_SECONDS = 30

interface OmokPanelProps {
  game: OmokGame
  myUid: string | null
  myName: string
  partnerName: string
  balance: number | null
  record: OmokRecord
  expanded: boolean
  onToggleExpanded: () => void
  onPlace: (x: number, y: number) => Promise<void>
  onSurrender: () => void
  onOpenBank: () => void
  onTimeout: () => void
}

export function OmokPanel({
  game, myUid, myName, partnerName, balance, record,
  expanded, onToggleExpanded, onPlace, onSurrender, onOpenBank, onTimeout,
}: OmokPanelProps) {
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const [placing, setPlacing] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  const isActive = game.status === 'active'
  const isMyTurn = isActive && myUid != null && game.nextTurnUid === myUid
  const myStone = myUid === game.blackUid ? '흑' : '백'

  // 새 게임·턴 전환 시 고스트 초기화
  useEffect(() => {
    setGhost(null)
  }, [game.id, game.moveCount])

  // 새 판이 열리면 전체화면은 기본 상태(창모드)로 돌린다
  useEffect(() => {
    setFullscreen(false)
  }, [game.id])

  // 착수 효과음 — 새 수가 도착하면(내 수·상대 수 모두) 딱 소리
  const prevMovesRef = useRef<{ id: string; count: number }>({ id: game.id, count: game.moveCount })
  useEffect(() => {
    const prev = prevMovesRef.current
    if (prev.id === game.id && game.moveCount > prev.count) playStoneSound()
    prevMovesRef.current = { id: game.id, count: game.moveCount }
  }, [game.id, game.moveCount])

  // 게임 종료 — 승리음 + 화면 가운데 큰 결과 오버레이(4초) + 전체화면 자동 복귀
  const [announce, setAnnounce] = useState<string | null>(null)
  const prevStatusRef = useRef(game.status)
  useEffect(() => {
    const ended = prevStatusRef.current === 'active'
      && (game.status === 'finished' || game.status === 'abandoned')
    prevStatusRef.current = game.status
    if (!ended) return

    if (game.result === 'five') playWinSound()

    const winnerName = game.winnerUid == null ? null
      : game.winnerUid === myUid ? myName : partnerName
    const text = game.result === 'draw' ? '무승부!'
      : game.result === 'cancelled' ? null
      : winnerName ? `${winnerName} 승리!`
      : null
    if (!text) return

    setAnnounce(text)
    const timer = window.setTimeout(() => {
      setAnnounce(null)
      // 결과를 보여준 뒤에는 전체화면을 닫아 채팅으로 돌아온다
      setFullscreen(false)
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [game.status, game.result, game.winnerUid, myUid, myName, partnerName])

  // 초재기 — 내 차례 동안 30초 카운트다운. 앱이 화면에서 사라지면 멈추고,
  // 돌아오면 30초를 새로 시작한다(채팅 앱 특성상 관대하게).
  // 0이 되면 시간패(onTimeout) — 마지막 10초는 틱, 5초 이하는 긴급 틱.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const deadlineRef = useRef<number | null>(null)
  const lastShownRef = useRef<number | null>(null)
  const timeoutFiredRef = useRef(false)
  // 부모 재렌더로 onTimeout 정체성이 바뀌어도 카운트다운이 리셋되지 않도록 ref로 고정
  const onTimeoutRef = useRef(onTimeout)
  useEffect(() => { onTimeoutRef.current = onTimeout }, [onTimeout])

  useEffect(() => {
    if (!isMyTurn || !isActive) {
      deadlineRef.current = null
      lastShownRef.current = null
      setSecondsLeft(null)
      return
    }

    timeoutFiredRef.current = false
    const startCountdown = () => {
      deadlineRef.current = Date.now() + TURN_SECONDS * 1000
      lastShownRef.current = TURN_SECONDS
      setSecondsLeft(TURN_SECONDS)
    }
    if (document.visibilityState === 'visible') startCountdown()

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const deadline = deadlineRef.current
      if (deadline == null) return
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      if (left !== lastShownRef.current) {
        lastShownRef.current = left
        setSecondsLeft(left)
        if (left > 0 && left <= 10) playTickSound(left <= 5)
      }
      if (left <= 0 && !timeoutFiredRef.current) {
        timeoutFiredRef.current = true
        playTimeoutSound()
        onTimeoutRef.current()
      }
    }, 250)

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        deadlineRef.current = null
        lastShownRef.current = null
        setSecondsLeft(null)
      } else if (deadlineRef.current == null && !timeoutFiredRef.current) {
        startCountdown()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isMyTurn, isActive, game.id, game.moveCount])

  const lastMove = game.moves[game.moves.length - 1] ?? null
  const blinkLast = isActive && isMyTurn && lastMove != null && lastMove.uid !== myUid
  const timerUrgent = secondsLeft != null && secondsLeft <= 10
  const timerText = secondsLeft != null ? ` · ${secondsLeft}초` : ''

  const handleConfirm = useCallback(async () => {
    if (!ghost || placing) return
    setPlacing(true)
    try {
      await onPlace(ghost.x, ghost.y)
      setGhost(null)
    } finally {
      setPlacing(false)
    }
  }, [ghost, placing, onPlace])

  // 단축키 — Enter: 착수 확정(턴 넘기기), F: 전체화면 토글, Space: 판 보임/감춤.
  // 채팅 입력창 등에서 타이핑 중일 때는 가로채지 않는다.
  // F는 물리 키(KeyF) 기준이라 한글 입력 상태(ㄹ)에서도 동작하고,
  // Ctrl+F(찾기) 같은 조합키는 브라우저에 그대로 넘긴다.
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement
      && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.code === 'KeyF') {
        e.preventDefault()
        setFullscreen((v) => !v)
        return
      }
      if (e.key === 'Enter') {
        if (ghost && isMyTurn && !placing) {
          e.preventDefault()
          void handleConfirm()
        }
        return
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        if (fullscreen) setFullscreen(false)
        else onToggleExpanded()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [ghost, isMyTurn, placing, fullscreen, handleConfirm, onToggleExpanded])

  // 상태 한 줄 (텍스트 라벨 — 색상만으로 구분하지 않는다)
  const statusText = isActive
    ? (isMyTurn ? `내 차례 (${myStone})` : `${partnerName} 차례`)
    : game.result === 'draw' ? '무승부'
    : game.result === 'cancelled' ? '판 취소됨'
    : game.winnerUid === myUid ? `${myName} 승리!`
    : `${partnerName} 승리`

  return (
    <div className="omok-wrap">
      <button type="button" className="omok-banner" onClick={onToggleExpanded} aria-expanded={expanded}>
        <span className="material-symbols-outlined omok-banner-icon" aria-hidden="true">sports_esports</span>
        <span className="omok-banner-body">
          <span className="omok-banner-title">
            오목 · {game.moveCount}수{game.bet > 0 ? ` · 판돈 ${formatKrw(game.bet)}` : ' · 친선전'}
          </span>
          <span className={`omok-turn-badge${isMyTurn ? ' omok-turn-badge--mine' : ''}${timerUrgent ? ' omok-turn-badge--urgent' : ''}`}>
            {statusText}{timerText}
          </span>
        </span>
        <span className="material-symbols-outlined" aria-hidden="true">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {expanded && (
        <section className="omok-panel" aria-label="오목판">
          <div className="omok-panel-status">
            <span className={timerUrgent ? 'omok-timer-urgent' : undefined}>{statusText}{timerText}</span>
            <span className="omok-panel-balance">
              잔액 {balance != null ? formatKrw(balance) : '확인 중'}
              <button type="button" className="omok-mini-btn" onClick={onOpenBank}>은행</button>
            </span>
          </div>

          <OmokBoard
            game={game}
            myUid={myUid}
            ghost={isMyTurn ? ghost : null}
            onCellTap={(x, y) => setGhost({ x, y })}
            disabled={!isMyTurn || placing}
            blinkLast={blinkLast}
          />

          {isMyTurn && ghost && (
            <button
              type="button"
              className="omok-confirm-btn"
              onClick={handleConfirm}
              disabled={placing}
            >
              {placing ? '두는 중…' : `${formatCoord(ghost.x, ghost.y)}에 두기`}
            </button>
          )}
          {isMyTurn && !ghost && (
            <p className="omok-hint-text">판을 눌러 자리를 고르세요</p>
          )}
          {!isMyTurn && isActive && (
            <p className="omok-hint-text">{partnerName}의 수를 기다리는 중…</p>
          )}
          {!isActive && (
            <p className="omok-hint-text">새 판을 시작하려면 /게임 오목 을 입력하세요</p>
          )}

          <div className="omok-panel-actions">
            <button type="button" className="omok-action-btn" onClick={() => setFullscreen(true)}>
              <span className="material-symbols-outlined omok-action-icon" aria-hidden="true">fullscreen</span>
              전체화면
            </button>
            {isActive && (
              <button type="button" className="omok-action-btn" onClick={onSurrender}>기권</button>
            )}
            <button type="button" className="omok-action-btn" onClick={onToggleExpanded}>접기</button>
          </div>

          <p className="omok-record-row">
            오늘 {formatBucket(record.today)} · 이번주 {formatBucket(record.week)} · 이번달 {formatBucket(record.month)} · 전체 {formatBucket(record.total)}
            {record.total.net !== 0 && ` (수지 ${record.total.net > 0 ? '+' : ''}${formatKrw(record.total.net)})`}
          </p>
        </section>
      )}

      {fullscreen && (
        <div className="omok-fullscreen" role="dialog" aria-label="오목판 전체화면">
          <div className="omok-fullscreen-top">
            <span className={`omok-fullscreen-status${timerUrgent ? ' omok-timer-urgent' : ''}`}>
              {statusText}{timerText}
              {game.bet > 0 && ` · 판돈 ${formatKrw(game.bet)}`}
            </span>
            <button type="button" className="omok-action-btn" onClick={() => setFullscreen(false)}>
              <span className="material-symbols-outlined omok-action-icon" aria-hidden="true">close_fullscreen</span>
              축소
            </button>
          </div>

          <div className="omok-fullscreen-board">
            <OmokBoard
              game={game}
              myUid={myUid}
              ghost={isMyTurn ? ghost : null}
              onCellTap={(x, y) => setGhost({ x, y })}
              disabled={!isMyTurn || placing}
              fullscreen
              blinkLast={blinkLast}
            />
          </div>

          {isMyTurn && ghost && (
            <button
              type="button"
              className="omok-confirm-btn"
              onClick={handleConfirm}
              disabled={placing}
            >
              {placing ? '두는 중…' : `${formatCoord(ghost.x, ghost.y)}에 두기`}
            </button>
          )}
          {isMyTurn && !ghost && (
            <p className="omok-hint-text">판을 눌러 자리를 고르세요</p>
          )}
          {!isMyTurn && isActive && (
            <p className="omok-hint-text">{partnerName}의 수를 기다리는 중…</p>
          )}
          {!isActive && (
            <p className="omok-hint-text">새 판을 시작하려면 /게임 오목 을 입력하세요</p>
          )}

          <div className="omok-panel-actions">
            {isActive && (
              <button type="button" className="omok-action-btn" onClick={onSurrender}>기권</button>
            )}
            <button type="button" className="omok-action-btn" onClick={() => setFullscreen(false)}>닫기</button>
          </div>
        </div>
      )}

      {announce && (
        <div className="omok-announce" role="status" aria-live="assertive">
          <span className="omok-announce-text">{announce}</span>
        </div>
      )}
    </div>
  )
}
