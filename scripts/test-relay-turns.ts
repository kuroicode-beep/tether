// scripts/test-relay-turns.ts — 릴레이소설 턴 규칙 검증
// ChatScreen이 쓰는 것과 같은 식으로 차례를 계산해 전환을 확인한다

const ME = 'uidA'
const PARTNER = 'uidB'

interface State { nextTurnUid: string; turnCount: number; status: string }

// ChatScreen의 계산식과 동일
const isMyTurn = (s: State, uid: string) => s.nextTurnUid === uid
const nextUid = (s: State, uid: string, partnerUid: string) =>
  (s.nextTurnUid === uid ? partnerUid : uid)

// 한 사람이 글을 보냈을 때의 결과
function send(s: State, uid: string, partnerUid: string) {
  if (!isMyTurn(s, uid)) return { state: s, recorded: false }
  return {
    state: {
      nextTurnUid: nextUid(s, uid, partnerUid),
      turnCount: s.turnCount + 1,
      status: 'active',
    },
    recorded: true,
  }
}

let pass = 0, total = 0
const check = (label: string, got: unknown, want: unknown) => {
  total += 1
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) pass += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} -> ${JSON.stringify(got)}`)
}

// 시작한 사람(나)이 첫 턴
let s: State = { nextTurnUid: ME, turnCount: 0, status: 'active' }
check('시작 직후 내 차례', isMyTurn(s, ME), true)
check('시작 직후 상대 차례 아님', isMyTurn(s, PARTNER), false)

// 차례가 아닌 사람이 보내면 턴으로 기록되지 않는다
let r = send(s, PARTNER, ME)
check('상대가 차례 아닐 때 보냄 — 기록 안 됨', r.recorded, false)
check('턴 수 그대로', r.state.turnCount, 0)

// 내가 보내면 기록되고 차례가 넘어간다
r = send(s, ME, PARTNER); s = r.state
check('내가 보냄 — 기록됨', r.recorded, true)
check('턴 수 1', s.turnCount, 1)
check('차례가 상대에게 넘어감', s.nextTurnUid, PARTNER)

// 연속으로 또 보내도 기록되지 않는다
r = send(s, ME, PARTNER)
check('연속 전송 — 기록 안 됨', r.recorded, false)

// 상대가 보내면 다시 나에게
r = send(s, PARTNER, ME); s = r.state
check('상대가 보냄 — 기록됨', r.recorded, true)
check('턴 수 2', s.turnCount, 2)
check('차례가 나에게 돌아옴', s.nextTurnUid, ME)

// 8턴 주고받기 — 항상 번갈아
let alt = true
let cur: State = { nextTurnUid: ME, turnCount: 0, status: 'active' }
const order: string[] = []
for (let i = 0; i < 8; i++) {
  const writer = cur.nextTurnUid
  order.push(writer === ME ? '나' : '상대')
  const out = send(cur, writer, writer === ME ? PARTNER : ME)
  if (!out.recorded) alt = false
  cur = out.state
}
check('8턴 번갈아 기록', alt, true)
check('턴 순서', order.join('-'), '나-상대-나-상대-나-상대-나-상대')
check('최종 턴 수', cur.turnCount, 8)

// /릴레이소설 끝 권한
const canPause = (st: State, uid: string) => isMyTurn(st, uid)
check('차례인 사람은 끝 가능', canPause({ nextTurnUid: ME, turnCount: 3, status: 'active' }, ME), true)
check('차례 아닌 사람은 끝 불가', canPause({ nextTurnUid: ME, turnCount: 3, status: 'active' }, PARTNER), false)

console.log(`\n${pass}/${total} 통과`)
if (pass !== total) process.exit(1)
