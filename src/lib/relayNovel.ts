// src/lib/relayNovel.ts
// 릴레이소설 명령어 파싱과 공용 타입.
// 채팅 입력이 명령어인지 판단하는 책임만 지고, 실행은 useRelayNovel이 맡는다.

export type RelayNovelStatus = 'active' | 'paused' | 'completed'

export interface RelayNovelTurn {
  authorUid: string
  authorName: string
  text: string
  at: number
  bySidekick?: boolean
}

export interface RelayNovel {
  id: string
  title: string
  status: RelayNovelStatus
  turns: RelayNovelTurn[]
  turnCount: number
  // 지금 쓸 차례인 사람. 한 턴씩 번갈아 쓰는 규칙의 기준이 된다.
  nextTurnUid: string
  startedBy: string
  startedAt: number | null
  completedAt: number | null
}

export type RelayCommand =
  | { kind: 'start'; title: string }
  | { kind: 'pause' }
  | { kind: 'complete' }
  | { kind: 'assist' }
  | { kind: 'help' }

const PREFIX = '/릴레이소설'

// 같은 뜻으로 자주 쓸 만한 표기를 함께 받는다
const ALIASES: Record<string, RelayCommand['kind']> = {
  '시작': 'start',
  '끝': 'pause',
  '일시정지': 'pause',
  '정지': 'pause',
  '완결': 'complete',
  '종료': 'complete',
  '도움': 'assist',
  '도와줘': 'assist',
  '이어줘': 'assist',
  '도움말': 'help',
  '': 'help',
}

// 채팅 입력을 릴레이소설 명령어로 해석한다. 명령어가 아니면 null.
export function parseRelayCommand(input: string): RelayCommand | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith(PREFIX)) return null

  const rest = trimmed.slice(PREFIX.length).trim()
  // "/릴레이소설시작"처럼 붙여 쓴 경우가 아니라 다른 명령어면 무시한다
  if (rest.length > 0 && !trimmed.startsWith(`${PREFIX} `)) {
    const glued = Object.keys(ALIASES).find((k) => k && rest.startsWith(k))
    if (!glued) return null
    return toCommand(glued, rest.slice(glued.length).trim())
  }

  const [head, ...tail] = rest.split(/\s+/)
  return toCommand(head ?? '', tail.join(' '))
}

function toCommand(keyword: string, argument: string): RelayCommand | null {
  const kind = ALIASES[keyword]
  if (!kind) return null
  if (kind === 'start') return { kind: 'start', title: argument.slice(0, 60) }
  return { kind }
}

export const RELAY_HELP_TEXT = [
  '릴레이소설 명령어',
  '/릴레이소설 시작 [제목] — 새 이야기를 시작해요',
  '/릴레이소설 끝 — 잠시 멈춰요 (차례인 사람만)',
  '/릴레이소설 완결 — 마무리하고 릴레이소설 서재에 보관해요',
  '/릴레이소설 도움 — 막힐 때 두세 문장을 이어받아요 (차례인 사람만)',
  '',
  '한 턴씩 번갈아 씁니다. 내 차례에 쓴 말이 그대로 한 턴이 되고,',
  '차례가 아닐 때 쓴 말은 소설에 들어가지 않는 평범한 대화가 돼요.',
].join('\n')

// 완결본을 문서 파일로 내려받을 때 쓰는 본문
export function buildNovelDocument(novel: RelayNovel): string {
  const lines: string[] = [`# ${novel.title}`, '']
  if (novel.startedAt) {
    const started = new Date(novel.startedAt).toLocaleDateString('ko-KR')
    const ended = novel.completedAt
      ? new Date(novel.completedAt).toLocaleDateString('ko-KR')
      : null
    lines.push(ended && ended !== started ? `${started} ~ ${ended}` : started, '')
  }
  novel.turns.forEach((turn, index) => {
    const label = turn.bySidekick ? `${turn.authorName} (이어쓰기 도움)` : turn.authorName
    lines.push(`## ${index + 1}. ${label}`, '', turn.text, '')
  })
  return lines.join('\n')
}
