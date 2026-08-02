// src/lib/relayNovel.ts
// 릴레이소설 명령어 파싱과 공용 타입.
// 채팅 입력이 명령어인지 판단하는 책임만 지고, 실행은 useRelayNovel이 맡는다.

// discarded — 초기화로 버려진 세션. 진행 중에도, 서재에도 나타나지 않는다.
export type RelayNovelStatus = 'active' | 'paused' | 'completed' | 'discarded'

export interface RelayNovelTurn {
  authorUid: string
  authorName: string
  text: string
  at: number
  bySidekick?: boolean
}

// 배경·장르·인물 설정 등 이어쓰기 도움에 함께 넘길 메모.
// 둘 다 언제든 추가·삭제할 수 있다.
export interface RelayBackgroundNote {
  id: string
  text: string
  byName: string
  at: number
}

export interface RelayNovel {
  id: string
  title: string
  background: RelayBackgroundNote[]
  // 초기화에 동의한 사람 목록. 둘 다 모이면 실행된다.
  resetVotes: string[]
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
  | { kind: 'write'; text: string }
  | { kind: 'view' }
  | { kind: 'title'; title: string }
  | { kind: 'background'; text: string }
  | { kind: 'backgroundRemove'; index: number }
  | { kind: 'reset' }
  | { kind: 'help' }

// 긴 표기를 먼저 확인한다 (짧은 축약이 긴 이름을 가로채지 않도록).
// "/릴레이 소설"처럼 띄어 쓰는 경우가 실제로 있어 함께 받는다.
const PREFIXES = ['/릴레이 소설', '/릴레이소설', '/릴소'] as const

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
  '쓰기': 'write',
  '턴': 'write',
  '이어': 'write',
  '보기': 'view',
  '읽기': 'view',
  '내용': 'view',
  '제목': 'title',
  '배경': 'background',
  '설정': 'background',
  '초기화': 'reset',
  '리셋': 'reset',
  '도움말': 'help',
  '명령어': 'help',
  '?': 'help',
  'help': 'help',
  '': 'help',
}

// "배경 삭제 2" 처럼 하위 명령으로 지우는 표기
const BACKGROUND_REMOVE_KEYWORDS = ['삭제', '지우기', '빼기']

// 채팅 입력을 릴레이소설 명령어로 해석한다. 명령어가 아니면 null.
export function parseRelayCommand(input: string): RelayCommand | null {
  const trimmed = input.trim()
  const prefix = PREFIXES.find((p) => trimmed.startsWith(p))
  if (!prefix) return null

  const rest = trimmed.slice(prefix.length).trim()
  // "/릴소시작"처럼 붙여 쓴 경우가 아니라 다른 명령어면 무시한다
  if (rest.length > 0 && !trimmed.startsWith(`${prefix} `)) {
    const glued = Object.keys(ALIASES).find((k) => k && rest.startsWith(k))
    if (!glued) return null
    return toCommand(glued, rest.slice(glued.length).trim())
  }

  // 첫 낱말만 떼어내고 나머지는 원문 그대로 넘긴다.
  // split(/\s+/) 후 다시 이어붙이면 줄바꿈이 공백으로 뭉개져
  // 여러 문단으로 쓴 소설 turn의 서식이 사라진다.
  const head = rest.split(/\s/, 1)[0] ?? ''
  const argument = rest.slice(head.length).replace(/^[^\S\n]*\n?/, '').replace(/^[^\S\n]+/, '')
  return toCommand(head, argument)
}

function toCommand(keyword: string, argument: string): RelayCommand | null {
  // 모르는 하위 명령이면 도움말을 보여준다. 오타로 조용히 일반 대화가 되면
  // 무엇을 잘못 쳤는지 알 수 없다.
  const kind = ALIASES[keyword] ?? 'help'
  if (!kind) return null

  if (kind === 'start') return { kind: 'start', title: argument.slice(0, 60) }
  if (kind === 'write') return { kind: 'write', text: argument.slice(0, 2000) }
  if (kind === 'title') return { kind: 'title', title: argument.slice(0, 60) }

  if (kind === 'background') {
    const [maybeRemove, ...rest] = argument.split(/\s+/)
    if (BACKGROUND_REMOVE_KEYWORDS.includes(maybeRemove)) {
      const index = Number.parseInt(rest.join(' ').trim(), 10)
      return { kind: 'backgroundRemove', index: Number.isFinite(index) ? index : 0 }
    }
    return { kind: 'background', text: argument.slice(0, 500) }
  }

  return { kind } as RelayCommand
}

export const RELAY_HELP_TEXT = [
  '📖 릴레이소설 명령어',
  '',
  '[쓰기]',
  '/릴소 쓰기 내용 — 내 차례의 한 턴을 써요',
  '/릴소 도움 — 막힐 때 두세 문장을 이어받아요 (차례인 사람만)',
  '',
  '[보기]',
  '/릴소 보기 — 지금까지 쓴 내용을 이어서 읽어요',
  '/릴소 배경 — 지금 설정을 봐요',
  '',
  '[이야기 관리]',
  '/릴소 시작 [제목] — 새 이야기를 시작해요',
  '/릴소 끝 — 잠시 멈춰요 (차례인 사람만)',
  '/릴소 완결 — 마무리하고 서재에 보관해요',
  '/릴소 초기화 — 둘 다 입력하면 본문과 설정을 비워요',
  '',
  '[제목·설정] 둘 다 언제든 바꿀 수 있어요',
  '/릴소 제목 새제목',
  '/릴소 배경 내용 — 장르·배경·인물 설정을 더해요',
  '/릴소 배경 삭제 2 — 2번 설정을 지워요',
  '',
  '※ /릴소 는 /릴레이소설 의 줄임말이에요. 둘 다 써도 됩니다.',
  '※ 한 턴씩 번갈아 씁니다. 슬래시(/) 명령만 소설로 처리되고,',
  '   그 외의 대화는 평범한 채팅으로 남아요.',
].join('\n')

// 세션을 열 때 함께 붙이는 짧은 안내 — 명령어를 몰라 막히지 않도록
export const RELAY_QUICK_HINT = [
  '/릴소 쓰기 내용 — 한 턴 쓰기',
  '/릴소 보기 — 지금까지 읽기',
  '/릴소 도움말 — 전체 명령어',
].join('\n')

// 배경 메모를 사람이 읽을 목록으로 만든다 (안내 메시지·문서 공용)
export function formatBackground(notes: RelayBackgroundNote[]): string {
  if (notes.length === 0) return '아직 설정이 없어요.'
  return notes.map((note, i) => `${i + 1}. ${note.text}`).join('\n')
}

// 완결본을 문서 파일로 내려받을 때 쓰는 본문
export function buildNovelDocument(novel: RelayNovel): string {
  const lines: string[] = [`# ${novel.title}`, '']
  if (novel.background.length > 0) {
    lines.push('## 설정', '', formatBackground(novel.background), '')
  }
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
