// 턴 삭제 롤백 로직 검증 (useRelayNovel.removeTurn과 동일한 계산)
let pass = 0, total = 0
const check = (label, got, want) => {
  total++
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) pass++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} -> ${JSON.stringify(got)}`)
}

const A = 'uidA', B = 'uidB'
function removeTurn(state, authorUid, text) {
  const trimmed = text.trim()
  const index = state.turns.map((turn, i) => ({ turn, i }))
    .filter(({ turn }) => turn.authorUid === authorUid && turn.text.trim() === trimmed)
    .pop()?.i
  if (index === undefined) return { changed: false, state }
  const wasLast = index === state.turns.length - 1
  const nextTurns = state.turns.filter((_, i) => i !== index)
  return {
    changed: true,
    state: {
      turns: nextTurns,
      turnCount: nextTurns.length,
      nextTurnUid: wasLast ? state.turns[index].authorUid : state.nextTurnUid,
    },
  }
}

// A(1) B(2) 쓴 뒤 차례는 A
let s = {
  turns: [
    { authorUid: A, text: '비가 그쳤다' },
    { authorUid: B, text: '우산을 집었다' },
  ],
  turnCount: 2,
  nextTurnUid: A,
}

// B가 자기 마지막 턴을 삭제 → 차례가 B에게 돌아와야 한다
let r = removeTurn(s, B, '우산을 집었다')
check('마지막 턴 삭제 — 반영됨', r.changed, true)
check('턴 수 1로 감소', r.state.turnCount, 1)
check('차례가 작성자(B)에게 복귀', r.state.nextTurnUid, B)

// 중간 턴 삭제는 본문만 빠지고 차례는 유지
s = {
  turns: [
    { authorUid: A, text: '1번' },
    { authorUid: B, text: '2번' },
    { authorUid: A, text: '3번' },
  ],
  turnCount: 3,
  nextTurnUid: B,
}
r = removeTurn(s, B, '2번')
check('중간 턴 삭제 — 반영됨', r.changed, true)
check('턴 수 2로 감소', r.state.turnCount, 2)
check('차례는 그대로(B)', r.state.nextTurnUid, B)
check('남은 본문 순서 유지', r.state.turns.map(t => t.text), ['1번', '3번'])

// 같은 내용이 두 번이면 마지막 것만
s = {
  turns: [
    { authorUid: A, text: '같은말' },
    { authorUid: B, text: '중간' },
    { authorUid: A, text: '같은말' },
  ],
  turnCount: 3,
  nextTurnUid: B,
}
r = removeTurn(s, A, '같은말')
check('중복 내용 — 마지막 것만 삭제', r.state.turns.map(t => t.text), ['같은말', '중간'])
check('마지막이었으므로 차례 복귀', r.state.nextTurnUid, A)

// 남의 턴은 못 지운다 (작성자 불일치)
r = removeTurn(s, B, '같은말')
check('작성자 불일치 — 변화 없음', r.changed, false)

// 소설에 없는 내용
r = removeTurn(s, A, '없는내용')
check('없는 턴 — 변화 없음', r.changed, false)

console.log(`\n${pass}/${total} 통과`)
process.exit(pass === total ? 0 : 1)
