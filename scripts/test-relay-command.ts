// scripts/test-relay-command.ts — 릴레이소설 명령어 파서 검증
import { parseRelayCommand } from '../src/lib/relayNovel'

const cases: Array<[string, unknown]> = [
  // 턴 쓰기는 명시 명령으로만
  ['/릴레이소설 쓰기 비가 그쳤다', { kind: 'write', text: '비가 그쳤다' }],
  ['/릴레이소설 턴 골목이 조용했다', { kind: 'write', text: '골목이 조용했다' }],
  ['/릴레이소설 쓰기', { kind: 'write', text: '' }],
  // 세션
  ['/릴레이소설 시작', { kind: 'start', title: '' }],
  ['/릴레이소설 시작 겨울의 끝', { kind: 'start', title: '겨울의 끝' }],
  ['/릴레이소설 끝', { kind: 'pause' }],
  ['/릴레이소설 완결', { kind: 'complete' }],
  ['/릴레이소설 도움', { kind: 'assist' }],
  // 제목
  ['/릴레이소설 제목 새로운 제목', { kind: 'title', title: '새로운 제목' }],
  // 배경
  ['/릴레이소설 배경', { kind: 'background', text: '' }],
  ['/릴레이소설 배경 1920년대 경성, 탐정물', { kind: 'background', text: '1920년대 경성, 탐정물' }],
  ['/릴레이소설 설정 주인공은 스무살', { kind: 'background', text: '주인공은 스무살' }],
  ['/릴레이소설 배경 삭제 2', { kind: 'backgroundRemove', index: 2 }],
  ['/릴레이소설 배경 지우기 1', { kind: 'backgroundRemove', index: 1 }],
  // 초기화
  ['/릴레이소설 초기화', { kind: 'reset' }],
  // 도움말
  ['/릴레이소설', { kind: 'help' }],
  // 축약 명령어 /릴소
  ['/릴소 쓰기 비가 그쳤다', { kind: 'write', text: '비가 그쳤다' }],
  ['/릴소 시작 겨울의 끝', { kind: 'start', title: '겨울의 끝' }],
  ['/릴소 끝', { kind: 'pause' }],
  ['/릴소 완결', { kind: 'complete' }],
  ['/릴소 도움', { kind: 'assist' }],
  ['/릴소 제목 새 제목', { kind: 'title', title: '새 제목' }],
  ['/릴소 배경 탐정물', { kind: 'background', text: '탐정물' }],
  ['/릴소 배경 삭제 2', { kind: 'backgroundRemove', index: 2 }],
  ['/릴소 초기화', { kind: 'reset' }],
  ['/릴소', { kind: 'help' }],
  ['/릴소시작 밤길', { kind: 'start', title: '밤길' }],
  ['/릴소 이상한명령', null],
  ['/릴', null],
  ['릴소 시작', null],
  // 띄어쓴 표기
  ['/릴레이 소설 도움', { kind: 'assist' }],
  ['/릴레이 소설 쓰기 비가 왔다', { kind: 'write', text: '비가 왔다' }],
  ['/릴레이 소설', { kind: 'help' }],
  // 명령이 아닌 것 — 전부 일반 대화로 흘러야 한다
  ['오늘 저녁 뭐 먹을까', null],
  ['릴레이소설 시작', null],
  ['/릴레이소설 이상한명령', null],
  ['/다른명령 시작', null],
  ['비가 그친 골목에 우산이 있었다', null],
]

let pass = 0
for (const [input, want] of cases) {
  const got = parseRelayCommand(input)
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) pass += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(input).padEnd(38)} -> ${JSON.stringify(got)}`)
}
console.log(`\n${pass}/${cases.length} 통과`)
if (pass !== cases.length) process.exit(1)
