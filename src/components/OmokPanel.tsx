// src/components/OmokPanel.tsx
// 채팅 상단 오목 드로어 — 접힘=한 줄 배너, 펼침=보드+상태+전적 (채팅과 동시 사용)
import { useState, useCallback, useEffect } from 'react'
import { OmokGame, formatCoord } from '../lib/omok'
import { formatKrw } from '../lib/gameWallet'
import { OmokBoard } from './OmokBoard'
import { OmokRecord, formatBucket } from '../hooks/useOmokRecord'

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
}

export function OmokPanel({
  game, myUid, myName, partnerName, balance, record,
  expanded, onToggleExpanded, onPlace, onSurrender, onOpenBank,
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
          <span className={`omok-turn-badge${isMyTurn ? ' omok-turn-badge--mine' : ''}`}>
            {statusText}
          </span>
        </span>
        <span className="material-symbols-outlined" aria-hidden="true">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {expanded && (
        <section className="omok-panel" aria-label="오목판">
          <div className="omok-panel-status">
            <span>{statusText}</span>
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
            <span className="omok-fullscreen-status">
              {statusText}
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
    </div>
  )
}
