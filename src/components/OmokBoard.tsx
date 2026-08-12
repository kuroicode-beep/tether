// src/components/OmokBoard.tsx
// 오목판 SVG — SVIL Baduk의 고대비 설계를 이식: 어두운 판 + 밝은 격자선,
// 테두리 반전 돌 + 「흑」「백」 글자 라벨(색만으로 구분하지 않는다),
// 호박색 마지막 수 점, 2겹 승리 라인, 초록 고스트 링(2단계 착수 1단계).
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
const STONE_R = Math.round(CELL * 0.44) // 14 — 바둑(0.42)보다 살짝 크게

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
  const winSet = useMemo(
    () => new Set((game.winLine ?? []).map((p) => `${p.x},${p.y}`)),
    [game.winLine],
  )

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
  const gridSpan = CELL * (size - 1)

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
      {/* 격자 영역 — 바깥 배경과 톤을 나눠 판 경계를 분명히 한다 */}
      <rect
        x={MARGIN - CELL / 2}
        y={MARGIN - CELL / 2}
        width={gridSpan + CELL}
        height={gridSpan + CELL}
        className="omok-board-grid-bg"
      />

      {Array.from({ length: size }, (_, i) => (
        <g key={`grid-${i}`} className="omok-board-line">
          <line x1={toSvg(0)} y1={toSvg(i)} x2={toSvg(size - 1)} y2={toSvg(i)} />
          <line x1={toSvg(i)} y1={toSvg(0)} x2={toSvg(i)} y2={toSvg(size - 1)} />
        </g>
      ))}

      {STAR_POINTS.map((p) => (
        <circle key={`star-${p.x}-${p.y}`} cx={toSvg(p.x)} cy={toSvg(p.y)} r={5} className="omok-board-star" />
      ))}

      {game.moves.map((m) => {
        const isBlack = m.uid === game.blackUid
        const isLast = lastMove != null && m.x === lastMove.x && m.y === lastMove.y
        return (
          <g key={`stone-${m.x}-${m.y}`}>
            <circle
              cx={toSvg(m.x)}
              cy={toSvg(m.y)}
              r={STONE_R}
              className={isBlack ? 'omok-stone-black' : 'omok-stone-white'}
            />
            {/* 색만으로 구분하지 않는다 — 바둑과 동일하게 글자 병기 */}
            <text
              x={toSvg(m.x)}
              y={toSvg(m.y) + 4}
              textAnchor="middle"
              className={`omok-stone-label ${isBlack ? 'omok-stone-label--black' : 'omok-stone-label--white'}`}
              aria-hidden="true"
            >
              {isBlack ? '흑' : '백'}
            </text>
            {isLast && !isLast2InWinLine(winSet, m.x, m.y) && (
              <circle
                cx={toSvg(m.x)}
                cy={toSvg(m.y)}
                r={STONE_R * 0.28}
                className="omok-last-marker"
              />
            )}
          </g>
        )
      })}

      {/* 승리 라인 — 검정 밑선 + 호박색 윗선 2겹, 승리 돌에는 링 */}
      {game.winLine && game.winLine.length >= 2 && (
        <g pointerEvents="none">
          <line
            x1={toSvg(game.winLine[0].x)}
            y1={toSvg(game.winLine[0].y)}
            x2={toSvg(game.winLine[game.winLine.length - 1].x)}
            y2={toSvg(game.winLine[game.winLine.length - 1].y)}
            className="omok-win-line-under"
          />
          <line
            x1={toSvg(game.winLine[0].x)}
            y1={toSvg(game.winLine[0].y)}
            x2={toSvg(game.winLine[game.winLine.length - 1].x)}
            y2={toSvg(game.winLine[game.winLine.length - 1].y)}
            className="omok-win-line"
          />
          {game.winLine.map((p) => (
            <circle
              key={`win-${p.x}-${p.y}`}
              cx={toSvg(p.x)}
              cy={toSvg(p.y)}
              r={STONE_R + 3}
              className="omok-win-ring"
            />
          ))}
        </g>
      )}

      {ghost && board[ghost.y]?.[ghost.x] == null && (
        <g className="omok-ghost" pointerEvents="none">
          <circle
            cx={toSvg(ghost.x)}
            cy={toSvg(ghost.y)}
            r={STONE_R}
            className={myStoneIsBlack ? 'omok-stone-black' : 'omok-stone-white'}
            opacity={0.55}
          />
          <circle cx={toSvg(ghost.x)} cy={toSvg(ghost.y)} r={STONE_R + 4} className="omok-ghost-ring" />
        </g>
      )}
    </svg>
  )
}

// 승리 라인 위의 돌에는 링이 그려지므로 마지막 수 점을 겹쳐 찍지 않는다
function isLast2InWinLine(winSet: Set<string>, x: number, y: number): boolean {
  return winSet.has(`${x},${y}`)
}
