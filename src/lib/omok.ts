// src/lib/omok.ts
// 오목 보드·승리 판정 순수 함수 (Firestore 비의존, 테스트 용이)

export const OMOK_BOARD_SIZE = 15
export const OMOK_MAX_MOVES = OMOK_BOARD_SIZE * OMOK_BOARD_SIZE

// 한 수 — at은 클라 시각(ms). arrayUnion에는 serverTimestamp를 넣을 수 없다.
export interface OmokMove {
  x: number
  y: number
  uid: string
  at: number
}

export type OmokGameStatus = 'active' | 'finished' | 'abandoned'
export type OmokResult = 'five' | 'surrender' | 'draw' | 'cancelled'

export interface OmokGame {
  id: string
  type: 'omok'
  status: OmokGameStatus
  boardSize: number
  moves: OmokMove[]
  moveCount: number
  nextTurnUid: string
  blackUid: string
  bet: number
  escrowUids: string[]
  startedBy: string
  startedAt: number | null
  finishedAt: number | null
  winnerUid: string | null
  result: OmokResult | null
  winLine: Array<{ x: number; y: number }> | null
  settled: boolean
}

// moves 배열에서 2차원 보드(uid 또는 null)를 만든다
export function buildBoard(moves: OmokMove[], size: number = OMOK_BOARD_SIZE): (string | null)[][] {
  const board: (string | null)[][] = Array.from({ length: size }, () => Array<string | null>(size).fill(null))
  for (const m of moves) {
    if (m.x >= 0 && m.x < size && m.y >= 0 && m.y < size) board[m.y][m.x] = m.uid
  }
  return board
}

// 해당 교차점에 이미 돌이 있는지
export function isOccupied(board: (string | null)[][], x: number, y: number): boolean {
  return board[y]?.[x] != null
}

// 마지막 수 기준 4방향(가로/세로/두 대각) 연속 5목 이상이면 승리 좌표열 반환
export function checkWin(
  board: (string | null)[][],
  last: { x: number; y: number; uid: string },
): Array<{ x: number; y: number }> | null {
  const size = board.length
  const dirs: Array<[number, number]> = [[1, 0], [0, 1], [1, 1], [1, -1]]
  for (const [dx, dy] of dirs) {
    const line: Array<{ x: number; y: number }> = [{ x: last.x, y: last.y }]
    for (const sign of [1, -1]) {
      let x = last.x + dx * sign
      let y = last.y + dy * sign
      while (x >= 0 && x < size && y >= 0 && y < size && board[y][x] === last.uid) {
        if (sign === 1) line.push({ x, y })
        else line.unshift({ x, y })
        x += dx * sign
        y += dy * sign
      }
    }
    if (line.length >= 5) return line
  }
  return null
}

// 좌표를 "H8" 형태로 표기한다 (열 A~O, 행 1~15 위에서 아래로)
export function formatCoord(x: number, y: number): string {
  return `${String.fromCharCode(65 + x)}${y + 1}`
}
