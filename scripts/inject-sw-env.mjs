// scripts/inject-sw-env.mjs
// 빌드 결과물의 FCM 서비스워커에 Firebase 설정을 주입한다.
//
// vite.config의 플러그인에서도 같은 치환을 하지만, vite-plugin-pwa가 그 뒤에
// public/을 다시 복사하면서 원본(플레이스홀더 그대로)으로 덮어쓴다.
// 그 결과 SW가 잘못된 설정으로 firebase를 초기화해 백그라운드 알림이
// 조용히 죽는다. 실제로 배포본에 플레이스홀더가 남아 있었다.
// 그래서 빌드 맨 마지막 단계로 분리하고, 남아 있으면 빌드를 실패시킨다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const SW_PATH = resolve('dist/firebase-messaging-sw.js')

const KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

// .env 파일을 읽는다 (CI 등에서는 process.env를 그대로 쓴다)
function loadEnv() {
  const env = { ...process.env }
  const envPath = resolve('.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (match) env[match[1]] = env[match[1]] ?? match[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}

if (!existsSync(SW_PATH)) {
  console.error('[inject-sw-env] dist/firebase-messaging-sw.js 가 없습니다.')
  process.exit(1)
}

const env = loadEnv()
const missing = KEYS.filter((key) => !env[key])
if (missing.length > 0) {
  console.error(`[inject-sw-env] 환경변수 누락: ${missing.join(', ')}`)
  process.exit(1)
}

let sw = readFileSync(SW_PATH, 'utf-8')
for (const key of KEYS) {
  sw = sw.replaceAll(`__${key}__`, env[key])
}
writeFileSync(SW_PATH, sw)

// 치환이 하나라도 남으면 알림이 죽으므로 빌드를 실패시킨다
const leftover = sw.match(/__VITE_[A-Z0-9_]+__/g)
if (leftover) {
  console.error(`[inject-sw-env] 치환되지 않은 값이 남았습니다: ${[...new Set(leftover)].join(', ')}`)
  process.exit(1)
}

console.log('[inject-sw-env] FCM 서비스워커 설정 주입 완료')
