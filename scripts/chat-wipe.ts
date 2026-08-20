// scripts/chat-wipe.ts
// 커플 채팅 데이터(메시지 · 첨부 인덱스 · Storage 첨부 실물)를 백업 / 삭제 / 검증하는 운영 도구.
//
// 사용법 (자격증명 규약은 scripts/test-e2e-firebase.ts와 동일)
//   set FIREBASE_SERVICE_ACCOUNT_PATH=C:\path\service-account.json
//   npx tsx scripts/chat-wipe.ts backup --couple <coupleId>
//   npx tsx scripts/chat-wipe.ts wipe   --couple <coupleId> --backup <백업파일> --yes
//   npx tsx scripts/chat-wipe.ts verify --couple <coupleId>
//
// 삭제 대상은 채팅 계열뿐이다. 교환일기 · 사진앨범 · 컨텐츠 · 릴레이소설 · 게임 기록은 건드리지 않는다.

import { createWriteStream, existsSync, readFileSync, statSync } from 'node:fs'
import { once } from 'node:events'
import { applicationDefault, cert, initializeApp, type Credential } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

// 채팅 첨부가 저장되는 Storage 접두사 (storage.rules의 chat 계열 경로와 1:1로 맞춘다)
const CHAT_STORAGE_PREFIXES = ['images/', 'files/'] as const
// 채팅 본문과 첨부 인덱스를 담는 Firestore 하위 컬렉션
const CHAT_COLLECTIONS = ['messages', 'files'] as const

// .env의 값을 process.env에 채운다 (이미 설정된 환경변수가 우선한다)
function loadEnv(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    process.env[key] = process.env[key] ?? value
  }
}

// 서비스 계정 자격증명을 환경변수에서 읽는다 (경로 / 원본 JSON / base64 순서로 허용)
function getAdminCredential(): Credential {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS
  try {
    if (rawJson) return cert(JSON.parse(rawJson))
    if (rawBase64) return cert(JSON.parse(Buffer.from(rawBase64, 'base64').toString('utf8')))
    if (path) return cert(JSON.parse(readFileSync(path, 'utf8')))
    return applicationDefault()
  } catch (error) {
    throw new Error(
      'Firebase Admin 자격증명을 읽지 못했습니다. 다음 중 하나를 설정하세요.\n' +
        '  - FIREBASE_SERVICE_ACCOUNT_PATH=C:\\path\\service-account.json\n' +
        '  - FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_BASE64\n' +
        `원인: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

// --flag value 형태의 인자를 파싱한다
function parseArgs(argv: string[]): { command: string; flags: Record<string, string | true> } {
  const [command = '', ...rest] = argv
  const flags: Record<string, string | true> = {}
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = rest[i + 1]
    if (next && !next.startsWith('--')) {
      flags[key] = next
      i += 1
    } else {
      flags[key] = true
    }
  }
  return { command, flags }
}

// 필수 문자열 플래그를 꺼낸다
function requireFlag(flags: Record<string, string | true>, name: string): string {
  const value = flags[name]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`--${name} 값이 필요합니다.`)
  }
  return value
}

// 프로젝트 ID와 Storage 버킷을 환경변수에서 결정한다 (하드코딩하지 않는다)
function resolveProjectConfig(): { projectId: string; bucket: string } {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || ''
  const bucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || ''
  if (!projectId || !bucket) {
    throw new Error(
      'FIREBASE_PROJECT_ID 와 FIREBASE_STORAGE_BUCKET 을 설정하세요 (.env 의 VITE_ 값과 동일).',
    )
  }
  return { projectId, bucket }
}

// 삭제 대상 커플이 맞는지 사람이 눈으로 확인할 수 있게 요약을 출력한다
async function printCoupleSummary(db: Firestore, coupleId: string): Promise<void> {
  const snap = await db.doc(`couples/${coupleId}`).get()
  if (!snap.exists) throw new Error(`couples/${coupleId} 문서가 없습니다. coupleId를 확인하세요.`)
  const data = snap.data() ?? {}
  const members = Array.isArray(data.members) ? data.members : []
  console.log(`대상 커플: couples/${coupleId}`)
  console.log(`  구성원 uid: ${members.join(', ') || '(members 필드 없음)'}`)
}

// 컬렉션의 문서 수를 센다 (삭제 전/후 판정 기준)
async function countCollection(db: Firestore, path: string): Promise<number> {
  const snap = await db.collection(path).count().get()
  return snap.data().count
}

// 메시지와 첨부 인덱스를 JSON 파일로 스트리밍 백업한다
async function runBackup(db: Firestore, coupleId: string, outPath: string): Promise<void> {
  const stream = createWriteStream(outPath, { encoding: 'utf8' })
  // 백프레셔를 존중하며 한 조각씩 쓴다 (수만 건에서도 메모리가 늘지 않게)
  const write = async (chunk: string) => {
    if (!stream.write(chunk)) await once(stream, 'drain')
  }

  await write(`{\n "coupleId": ${JSON.stringify(coupleId)},\n`)
  await write(` "exportedAt": ${JSON.stringify(new Date().toISOString())},\n`)

  for (const [index, name] of CHAT_COLLECTIONS.entries()) {
    await write(` ${JSON.stringify(name)}: [\n`)
    let first = true
    let count = 0
    // orderBy 없이 전체를 순회한다 (createdAt이 없는 문서도 빠뜨리지 않기 위해)
    const docs = db.collection(`couples/${coupleId}/${name}`).stream() as AsyncIterable<
      FirebaseFirestore.QueryDocumentSnapshot
    >
    for await (const doc of docs) {
      const record = { id: doc.id, ...doc.data() }
      await write(`${first ? '  ' : ',\n  '}${JSON.stringify(record)}`)
      first = false
      count += 1
      if (count % 1000 === 0) console.log(`  ${name}: ${count}건 백업`)
    }
    await write(`\n ]${index === CHAT_COLLECTIONS.length - 1 ? '' : ','}\n`)
    console.log(`  ${name}: 총 ${count}건 백업 완료`)
  }

  await write('}\n')
  stream.end()
  await once(stream, 'finish')
  console.log(`백업 파일: ${outPath} (${(statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`)
}

// 채팅 컬렉션과 Storage 첨부를 삭제한다
async function runWipe(db: Firestore, bucketName: string, coupleId: string): Promise<void> {
  for (const name of CHAT_COLLECTIONS) {
    const path = `couples/${coupleId}/${name}`
    const before = await countCollection(db, path)
    console.log(`${path}: ${before}건 삭제 시작`)
    // recursiveDelete는 BulkWriter로 내부 배치·재시도를 처리한다
    await db.recursiveDelete(db.collection(path))
    console.log(`${path}: 삭제 요청 완료`)
  }

  const bucket = getStorage().bucket(bucketName)
  for (const prefix of CHAT_STORAGE_PREFIXES) {
    const full = `couples/${coupleId}/${prefix}`
    const [files] = await bucket.getFiles({ prefix: full })
    console.log(`storage ${full}: ${files.length}개 삭제 시작`)
    await bucket.deleteFiles({ prefix: full, force: true })
    console.log(`storage ${full}: 삭제 요청 완료`)
  }
}

// 삭제가 실제로 끝났는지 서버 상태로 검증한다 (0이 아니면 실패로 본다)
async function runVerify(db: Firestore, bucketName: string, coupleId: string): Promise<boolean> {
  let ok = true
  for (const name of CHAT_COLLECTIONS) {
    const path = `couples/${coupleId}/${name}`
    const remaining = await countCollection(db, path)
    console.log(`${path}: 잔여 ${remaining}건 ${remaining === 0 ? 'OK' : '실패'}`)
    if (remaining !== 0) ok = false
  }

  const bucket = getStorage().bucket(bucketName)
  for (const prefix of CHAT_STORAGE_PREFIXES) {
    const full = `couples/${coupleId}/${prefix}`
    const [files] = await bucket.getFiles({ prefix: full })
    console.log(`storage ${full}: 잔여 ${files.length}개 ${files.length === 0 ? 'OK' : '실패'}`)
    if (files.length !== 0) ok = false
  }
  return ok
}

// 기본 백업 파일명을 만든다 (YYYYMMDD)
function defaultBackupName(): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `tether_chat_backup_${stamp}.json`
}

// 진입점: 명령을 분기하고 안전장치를 건다
async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2))
  loadEnv(typeof flags.env === 'string' ? flags.env : '.env')
  const coupleId = requireFlag(flags, 'couple')
  const { projectId, bucket } = resolveProjectConfig()

  initializeApp({ credential: getAdminCredential(), projectId, storageBucket: bucket })
  const db = getFirestore()

  if (command === 'backup') {
    await printCoupleSummary(db, coupleId)
    const out = typeof flags.out === 'string' ? flags.out : defaultBackupName()
    await runBackup(db, coupleId, out)
    return
  }

  if (command === 'wipe') {
    // 인자 오류는 서버를 건드리기 전에 잡는다
    const backup = requireFlag(flags, 'backup')
    if (!existsSync(backup)) {
      throw new Error(
        `백업 파일이 없습니다: ${backup} (경로를 확인하거나 backup 명령을 먼저 실행하세요)`,
      )
    }
    if (flags.yes !== true) {
      throw new Error('되돌릴 수 없는 삭제입니다. 실행하려면 --yes 를 붙이세요.')
    }
    await printCoupleSummary(db, coupleId)
    await runWipe(db, bucket, coupleId)
    console.log('--- 삭제 후 검증 ---')
    const ok = await runVerify(db, bucket, coupleId)
    if (!ok) process.exitCode = 1
    return
  }

  if (command === 'verify') {
    const ok = await runVerify(db, bucket, coupleId)
    if (!ok) process.exitCode = 1
    return
  }

  throw new Error('명령은 backup | wipe | verify 중 하나여야 합니다.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
