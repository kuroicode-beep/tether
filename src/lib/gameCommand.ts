// src/lib/gameCommand.ts
// 채팅 슬래시 게임 명령 파서 (relayNovel.ts의 parseRelayCommand 구조 미러)
import { OMOK_DEFAULT_BET, normalizeBet } from './gameWallet'

export type GameCommand =
  | { kind: 'start'; bet: number }
  | { kind: 'surrender' }
  | { kind: 'charge' }
  | { kind: 'bank' }
  | { kind: 'record' }
  | { kind: 'help' }

// 긴 접두어를 앞에 둬야 짧은 별칭이 가로채지 않는다
const PREFIXES = ['/게임', '/오목'] as const

const ALIASES: Record<string, GameCommand['kind']> = {
  '오목': 'start',
  '시작': 'start',
  '기권': 'surrender',
  '항복': 'surrender',
  '충전': 'charge',
  '은행': 'bank',
  '지갑': 'bank',
  '잔액': 'bank',
  '전적': 'record',
  '기록': 'record',
  '도움말': 'help',
  '도움': 'help',
  '명령어': 'help',
  '?': 'help',
  'help': 'help',
}

// "10000", "10,000", "10000원" → 베팅 금액. 숫자가 아니면 null
function parseBet(raw: string): number | null {
  const cleaned = raw.replace(/[,원\s]/g, '')
  if (!cleaned) return null
  if (!/^\d+$/.test(cleaned)) return null
  return normalizeBet(Number(cleaned))
}

// 게임 명령이 아니면 null — 호출부는 일반 대화로 처리한다
export function parseGameCommand(input: string): GameCommand | null {
  const trimmed = input.trim()
  const prefix = PREFIXES.find((p) => trimmed.startsWith(p))
  if (!prefix) return null

  let rest = trimmed.slice(prefix.length)
  // 붙여쓰기 지원: "/게임오목", "/오목기권"
  if (rest && !/^\s/.test(rest)) {
    const glued = Object.keys(ALIASES).find((k) => k.length > 1 && rest.startsWith(k))
    if (!glued && !/^\d/.test(rest)) return null
    if (glued) rest = `${glued} ${rest.slice(glued.length)}`
  }
  rest = rest.trim()

  // "/오목" 단독·"/오목 10000" — 오목 접두어는 곧 시작 명령이다
  if (prefix === '/오목') {
    if (!rest) return { kind: 'start', bet: OMOK_DEFAULT_BET }
    const head = rest.split(/\s+/, 1)[0] ?? ''
    const directBet = parseBet(head)
    if (directBet != null) return { kind: 'start', bet: directBet }
    const kind = ALIASES[head] ?? 'help'
    if (kind === 'start') {
      const bet = parseBet(rest.slice(head.length).trim())
      return { kind: 'start', bet: bet ?? OMOK_DEFAULT_BET }
    }
    return { kind }
  }

  // "/게임 ..." — 하위 명령 필수, 모르는 키워드는 도움말
  if (!rest) return { kind: 'help' }
  const head = rest.split(/\s+/, 1)[0] ?? ''
  const kind = ALIASES[head] ?? 'help'
  if (kind === 'start') {
    const bet = parseBet(rest.slice(head.length).trim())
    return { kind: 'start', bet: bet ?? OMOK_DEFAULT_BET }
  }
  return { kind }
}

export const OMOK_HELP_TEXT = [
  '오목 게임 명령어',
  '',
  '[게임]',
  '/게임 오목 — 오목 시작 (판돈 1,000원)',
  '/게임 오목 10000 — 판돈을 정해서 시작 (0~50,000원)',
  '/게임 기권 — 진행 중인 판 기권 (판돈은 상대에게)',
  '',
  '[게임머니]',
  '/게임 은행 — 잔고·충전·사용내역 보기',
  '/게임 충전 — 5만원 충전 (잔액 5만원 이하일 때, 하루 3번, 8시간 간격)',
  '/게임 전적 — 오늘·이번주·이번달·전체 전적',
  '',
  '※ 돌은 채팅이 아니라 위 오목판을 눌러서 둡니다.',
  '※ /오목 으로 줄여 쓸 수 있어요. 예) /오목 5000',
].join('\n')

export const OMOK_QUICK_HINT = [
  '판을 눌러 자리를 고르고 [여기에 두기]로 확정하세요.',
  '시작한 사람이 흑돌, 먼저 둡니다.',
  '5목을 먼저 만들면 판돈을 전부 가져가요!',
].join('\n')
