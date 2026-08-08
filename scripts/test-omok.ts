// scripts/test-omok.ts
// 오목 순수 로직 검증 — 승리 판정 / 게임 명령 파서 / 충전 가능 판정
import { buildBoard, checkWin, formatCoord, OMOK_MAX_MOVES, type OmokMove } from '../src/lib/omok'
import { parseGameCommand } from '../src/lib/gameCommand'
import { computeChargeEligibility, normalizeBet } from '../src/lib/gameWallet'

let pass = 0
let total = 0
function check(label: string, got: unknown, want: unknown) {
  total += 1
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) pass += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` -> got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}

const A = 'userA'
const B = 'userB'
const mv = (x: number, y: number, uid: string): OmokMove => ({ x, y, uid, at: 0 })

// 가로 5목
{
  const moves = [0, 1, 2, 3, 4].map((x) => mv(x, 7, A))
  const board = buildBoard(moves)
  check('가로 5목', checkWin(board, { x: 4, y: 7, uid: A })?.length, 5)
}
// 세로 5목 (경계 0,0 시작)
{
  const moves = [0, 1, 2, 3, 4].map((y) => mv(0, y, A))
  check('세로 5목 경계', checkWin(buildBoard(moves), { x: 0, y: 0, uid: A })?.length, 5)
}
// 대각 ↘ 5목 (마지막 수가 중간)
{
  const moves = [0, 1, 2, 3, 4].map((i) => mv(i, i, B))
  check('대각 5목 중간수', checkWin(buildBoard(moves), { x: 2, y: 2, uid: B })?.length, 5)
}
// 역대각 ↗ 5목 (경계 14,14 근처)
{
  const moves = [0, 1, 2, 3, 4].map((i) => mv(10 + i, 14 - i, A))
  check('역대각 5목', checkWin(buildBoard(moves), { x: 14, y: 10, uid: A })?.length, 5)
}
// 장목(6목) 승 인정
{
  const moves = [0, 1, 2, 3, 4, 5].map((x) => mv(x, 3, A))
  check('장목 6목 승', (checkWin(buildBoard(moves), { x: 5, y: 3, uid: A })?.length ?? 0) >= 5, true)
}
// 4목은 승 아님 / 상대 돌 끼면 끊김
{
  const moves = [mv(0, 0, A), mv(1, 0, A), mv(2, 0, B), mv(3, 0, A), mv(4, 0, A)]
  check('끊긴 줄 무승', checkWin(buildBoard(moves), { x: 4, y: 0, uid: A }), null)
}
check('좌표 표기', formatCoord(7, 7), 'H8')
check('최대 수', OMOK_MAX_MOVES, 225)

// 명령 파서
check('시작 기본', parseGameCommand('/게임 오목'), { kind: 'start', bet: 1000 })
check('시작 금액', parseGameCommand('/게임 오목 10000'), { kind: 'start', bet: 10000 })
check('오목 축약 금액', parseGameCommand('/오목 5,000원'), { kind: 'start', bet: 5000 })
check('오목 단독', parseGameCommand('/오목'), { kind: 'start', bet: 1000 })
check('붙여쓰기 기권', parseGameCommand('/게임기권'), { kind: 'surrender' })
check('은행', parseGameCommand('/게임 은행'), { kind: 'bank' })
check('충전', parseGameCommand('/게임 충전'), { kind: 'charge' })
check('전적', parseGameCommand('/오목 전적'), { kind: 'record' })
check('모르는 하위명령→help', parseGameCommand('/게임 아무거나'), { kind: 'help' })
check('일반 대화 무시', parseGameCommand('오늘 뭐해?'), null)
check('릴소 명령 무시', parseGameCommand('/릴소 시작'), null)
check('베팅 상한', normalizeBet(999999), 50000)
check('베팅 반올림', normalizeBet(1234), 1200)

// 충전 판정 — 기준시각 고정, 잔액 5만원 이하 조건 포함
const NOON = new Date('2026-08-08T12:00:00+09:00').getTime()
const H = 60 * 60 * 1000
check('첫 충전 가능', computeChargeEligibility([], NOON, 0), { ok: true })
check('쿨다운 차단', computeChargeEligibility([NOON - 2 * H], NOON, 0).reason, 'cooldown')
check('8시간 경과 가능', computeChargeEligibility([NOON - 9 * H], NOON, 0), { ok: true })
check('하루 3회 차단', computeChargeEligibility([NOON - 1 * H, NOON - 9 * H, NOON - 11 * H], NOON, 0).reason, 'daily')
check('어제 충전은 오늘 카운트 제외', computeChargeEligibility([NOON - 13 * H, NOON - 30 * H, NOON - 40 * H], NOON, 0), { ok: true })
check('잔액 5만원 초과 차단', computeChargeEligibility([], NOON, 50_100).reason, 'balance')
check('잔액 정확히 5만원 허용', computeChargeEligibility([], NOON, 50_000), { ok: true })
check('잔액 차단이 쿨다운보다 우선', computeChargeEligibility([NOON - 2 * H], NOON, 120_000).reason, 'balance')

console.log(`\n${pass}/${total} passed`)
if (pass !== total) process.exit(1)
