// scripts/test-relay-firestore.mjs
// 릴레이소설 데이터 흐름을 실제 Firestore에 대고 검증한다.
// 앱의 useRelayNovel이 수행하는 것과 같은 쓰기/조회를 그대로 재현하고,
// 끝나면 만든 데이터를 지운다.
//
// 인증: firebase CLI 로그인 토큰으로 ADC를 만든다 (사이드카와 동일한 방식).
// 주의: Admin SDK는 보안 규칙을 우회하므로 규칙 검증은 이 스크립트 범위가 아니다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PROJECT_ID = 'tether-d1dab'
const UID_A = 'e2e-relay-a'
const UID_B = 'e2e-relay-b'
const COUPLE_ID = [UID_A, UID_B].sort().join('_')

function buildAdc() {
  const store = JSON.parse(fs.readFileSync(
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8',
  ))
  const refresh_token = store?.tokens?.refresh_token
  if (!refresh_token) throw new Error('firebase login 이 필요합니다')
  const dir = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'tether-relay-test')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'adc.json')
  fs.writeFileSync(file, JSON.stringify({
    type: 'authorized_user',
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token,
  }))
  return file
}

process.env.GOOGLE_APPLICATION_CREDENTIALS = buildAdc()

const { initializeApp, applicationDefault } = await import('firebase-admin/app')
const { getFirestore, FieldValue, Timestamp } = await import('firebase-admin/firestore')

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
const db = getFirestore(app)
const novels = db.collection(`couples/${COUPLE_ID}/relayNovels`)

let pass = 0
let total = 0
function check(label, got, want) {
  total += 1
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) pass += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} -> ${JSON.stringify(got)}`)
}

const read = async (id) => (await novels.doc(id).get()).data()

// 앱의 조회와 동일
const findOngoing = async () => {
  const s = await novels.where('status', 'in', ['active', 'paused']).limit(1).get()
  return s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() }
}
const findLibrary = async () => {
  const s = await novels.where('status', '==', 'completed').orderBy('completedAt', 'desc').limit(50).get()
  return s.docs.map((d) => ({ id: d.id, ...d.data() }))
}

const createdIds = []

try {
  console.log('=== 1. 시작 ===')
  const startRef = await novels.add({
    title: '테스트 이야기', background: [], resetVotes: [],
    status: 'active', turns: [], turnCount: 0,
    nextTurnUid: UID_A, startedBy: UID_A,
    startedAt: Timestamp.now(), completedAt: null,
  })
  createdIds.push(startRef.id)
  let doc = await read(startRef.id)
  check('상태 active', doc.status, 'active')
  check('첫 차례는 시작한 사람', doc.nextTurnUid, UID_A)
  check('진행 중 조회에 잡힘', (await findOngoing())?.id, startRef.id)

  console.log('\n=== 2. 턴 쓰기 (A → B → A) ===')
  const writeTurn = async (uid, name, text, nextUid) => {
    await novels.doc(startRef.id).update({
      turns: FieldValue.arrayUnion({ authorUid: uid, authorName: name, text, at: Date.now() }),
      turnCount: FieldValue.increment(1),
      nextTurnUid: nextUid,
      resetVotes: [],
    })
  }
  await writeTurn(UID_A, '테스트가', '비가 그친 골목에 우산이 놓여 있었다.', UID_B)
  doc = await read(startRef.id)
  check('1턴 기록', doc.turnCount, 1)
  check('차례가 B로', doc.nextTurnUid, UID_B)

  await writeTurn(UID_B, '테스트나', '나는 그 우산을 집어 들었다.', UID_A)
  doc = await read(startRef.id)
  check('2턴 기록', doc.turnCount, 2)
  check('차례가 A로', doc.nextTurnUid, UID_A)
  check('본문 2개 누적', doc.turns.length, 2)
  check('본문 순서 유지', doc.turns[0].text.startsWith('비가'), true)

  console.log('\n=== 3. 제목·배경 ===')
  await novels.doc(startRef.id).update({ title: '우산의 주인' })
  check('제목 변경', (await read(startRef.id)).title, '우산의 주인')

  const note1 = { id: 'n1', text: '1920년대 경성, 탐정물', byName: '테스트가', at: Date.now() }
  const note2 = { id: 'n2', text: '주인공은 스무 살, 말수가 적다', byName: '테스트나', at: Date.now() }
  await novels.doc(startRef.id).update({ background: FieldValue.arrayUnion(note1) })
  await novels.doc(startRef.id).update({ background: FieldValue.arrayUnion(note2) })
  doc = await read(startRef.id)
  check('배경 2개', doc.background.length, 2)
  check('배경 작성자 기록', doc.background[1].byName, '테스트나')

  await novels.doc(startRef.id).update({
    background: doc.background.filter((n) => n.id !== 'n1'),
  })
  doc = await read(startRef.id)
  check('배경 1개 삭제됨', doc.background.length, 1)
  check('남은 배경', doc.background[0].id, 'n2')

  console.log('\n=== 4. 멈춤 / 이어쓰기 ===')
  await novels.doc(startRef.id).update({ status: 'paused' })
  check('멈춤 상태도 진행 중 조회에 잡힘', (await findOngoing())?.id, startRef.id)
  await novels.doc(startRef.id).update({ status: 'active' })
  check('다시 active', (await read(startRef.id)).status, 'active')

  console.log('\n=== 5. 초기화 합의 ===')
  await novels.doc(startRef.id).update({ resetVotes: [UID_A] })
  doc = await read(startRef.id)
  const bothAgreed = doc.resetVotes.includes(UID_A) && doc.resetVotes.includes(UID_B)
  check('A만 동의 — 실행 안 함', bothAgreed, false)
  check('본문 그대로', (await read(startRef.id)).turnCount, 2)

  await novels.doc(startRef.id).update({
    turns: [], turnCount: 0, background: [], resetVotes: [], status: 'discarded',
  })
  doc = await read(startRef.id)
  check('초기화 후 본문 비움', doc.turnCount, 0)
  check('초기화 후 배경 비움', doc.background.length, 0)
  check('초기화 후 세션 닫힘', doc.status, 'discarded')
  check('진행 중 조회에 안 잡힘 (새로 시작 가능)', await findOngoing(), null)

  console.log('\n=== 6. 완결 → 서재 ===')
  const doneRef = await novels.add({
    title: '완결 테스트', background: [], resetVotes: [],
    status: 'active', turns: [], turnCount: 0,
    nextTurnUid: UID_A, startedBy: UID_A,
    startedAt: Timestamp.now(), completedAt: null,
  })
  createdIds.push(doneRef.id)
  await doneRef.update({
    turns: FieldValue.arrayUnion({ authorUid: UID_A, authorName: '테스트가', text: '끝.', at: Date.now() }),
    turnCount: FieldValue.increment(1),
  })
  await doneRef.update({ status: 'completed', completedAt: Timestamp.now() })

  const library = await findLibrary()
  check('서재 조회 성공 (복합 인덱스 동작)', Array.isArray(library), true)
  check('완결본이 서재에 있음', library.some((n) => n.id === doneRef.id), true)
  check('초기화된 세션은 서재에 없음', library.some((n) => n.id === startRef.id), false)
  check('완결본은 진행 중 조회에 없음', await findOngoing(), null)
} finally {
  console.log('\n=== 정리 ===')
  for (const id of createdIds) await novels.doc(id).delete()
  await db.doc(`users/${UID_A}`).delete()
  await db.doc(`users/${UID_B}`).delete()
  await db.doc(`couples/${COUPLE_ID}`).delete()
  console.log('테스트 데이터 삭제 완료')
}

console.log(`\n${pass}/${total} 통과`)
process.exit(pass === total ? 0 : 1)
