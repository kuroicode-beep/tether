// scripts/test-relay-command.ts — 릴레이소설 명령어 파서 검증
import { parseRelayCommand } from '../src/lib/relayNovel'

const cases: Array<[string, unknown]> = [
  ['/릴레이소설 시작', { kind: 'start', title: '' }],
  ['/릴레이소설 시작 겨울의 끝', { kind: 'start', title: '겨울의 끝' }],
  ['/릴레이소설 끝', { kind: 'pause' }],
  ['/릴레이소설 일시정지', { kind: 'pause' }],
  ['/릴레이소설 완결', { kind: 'complete' }],
  ['/릴레이소설 도움', { kind: 'assist' }],
  ['/릴레이소설', { kind: 'help' }],
  ['  /릴레이소설 도움  ', { kind: 'assist' }],
  ['/릴레이소설시작 밤길', { kind: 'start', title: '밤길' }],
  ['/릴레이소설 이상한명령', null],
  ['릴레이소설 시작', null],
  ['오늘 저녁 뭐 먹을까', null],
  ['/다른명령 시작', null],
]

let pass = 0
for (const [input, want] of cases) {
  const got = parseRelayCommand(input)
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) pass += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(input).padEnd(30)} -> ${JSON.stringify(got)}`)
}
console.log(`\n${pass}/${cases.length} 통과`)
if (pass !== cases.length) process.exit(1)
