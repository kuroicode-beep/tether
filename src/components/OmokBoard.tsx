// src/components/OmokBoard.tsx
// 오목판 SVG — 격자·화점·돌·마지막 수 마커·승리 라인·고스트 돌(2단계 착수 1단계)
import { useMemo, useCallback, useRef } from 'react'
import { OmokGame, buildBoard } from '../lib/omok'

interface OmokBoardProps {
  game: OmokGame
  myUid: string | null
  ghost: { x: number; y: number } | null
  onCellTap: (x: number, y: number) => void
  disabled: boolean
}

const MARGIN = 24
const CELL = 32
const VIEW = MARGIN * 2 + CELL * 14 // 15줄 = 간격 14칸

// 격자 인덱스 → SVG 좌표
function toSvg(i: number): number {
  return MARGIN + i * CELL
}

const STAR_POINTS = [3, 7, 11].flatMap((x) => [3, 7, 11].map((y) => ({ x, y })))

export function OmokBoard({ game, myUid, ghost, onCellTap, disabled }: OmokBoardProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const board = useMemo(() => buildBoard(game.moves, game.boardSize), [game.moves, game.boardSize])
  const lastMove = game.moves[game.moves.length - 1] ?? null
  const myStoneIsBlack = myUid === game.blackUid

  // 탭 좌표를 가장 가까운 교차점으로 스냅한다
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * VIEW
    const py = ((e.clientY - rect.top) / rect.height) * VIEW
    const x = Math.round((px - MARGIN) / CELL)
    const y = Math.round((py - MARGIN) / CELL)
    if (x < 0 || x >= game.boardSize || y < 0 || y >= game.boardSize) return
    if (board[y][x] != null) return
    onCellTap(x, y)
  }, [disabled, board, game.boardSize, onCellTap])

  const size = game.boardSize

  return (
    <svg
      ref={svgRef}
      className="omok-board"
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      role="img"
      aria-label={`오목판, ${game.moveCount}수 진행`}
      onPointerDown={handlePointerDown}
    >
      <rect x={0} y={0} width={VIEW} height={VIEW} rx={12} className="omok-board-bg" />

      {Array.from({ length: size }, (_, i) => (
        <g key={`grid-${i}`} className="omok-board-line">
          <line x1={toSvg(0)} y1={toSvg(i)} x2={toSvg(size - 1)} y2={toSvg(i)} />
          <line x1={toSvg(i)} y1={toSvg(0)} x2={toSvg(i)} y2={toSvg(size - 1)} />
        </g>
      ))}

      {STAR_POINTS.map((p) => (
        <circle key={`star-${p.x}-${p.y}`} cx={toSvg(p.x)} cy={toSvg(p.y)} r={3.2} className="omok-board-star" />
      ))}

      {game.winLine && game.winLine.length >= 2 && (
        <line
          x1={toSvg(game.winLine[0].x)}
          y1={toSvg(game.winLine[0].y)}
          x2={toSvg(game.winLine[game.winLine.length - 1].x)}
          y2={toSvg(game.winLine[game.winLine.length - 1].y)}
          className="omok-win-line"
        />
      )}

      {game.moves.map((m) => {
        const isBlack = m.uid === game.blackUid
        const isLast = lastMove != null && m.x === lastMove.x && m.y === lastMove.y
        return (
          <g key={`stone-${m.x}-${m.y}`}>
            <circle
              cx={toSvg(m.x)}
              cy={toSvg(m.y)}
              r={13}
              className={isBlack ? 'omok-stone-black' : 'omok-stone-white'}
            />
            {isLast && game.status === 'active' && (
              <rect
                x={toSvg(m.x) - 4}
                y={toSvg(m.y) - 4}
                width={8}
                height={8}
                className="omok-last-marker"
              />
            )}
          </g>
        )
      })}

      {ghost && board[ghost.y]?.[ghost.x] == null && (
        <g className="omok-ghost">
          <circle
            cx={toSvg(ghost.x)}
            cy={toSvg(ghost.y)}
            r={13}
            className={myStoneIsBlack ? 'omok-stone-black' : 'omok-stone-white'}
            opacity={0.45}
          />
          <circle cx={toSvg(ghost.x)} cy={toSvg(ghost.y)} r={16} className="omok-ghost-ring" />
        </g>
      )}
    </svg>
  )
}
