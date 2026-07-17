// sidecar/index.js
// Tether Windows 알림 사이드카 — Firestore 실시간 리스너 → 네이티브 토스트 + 커스텀 사운드
// FCM/크롬 경로를 우회해 알림 안정성을 보장한다.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile, exec } = require('child_process')

const APP_VERSION = '0.2.0'
const VERSION_HISTORY = [
  { version: '0.2.0', date: '2026-07-17', summary: '로컬 ping 서버(웹앱 중복 알림 방지 연동), Tether 창 포커스 시 알림 억제' },
  { version: '0.1.0', date: '2026-07-17', summary: '최초 릴리스 — 메시지/상태/일기 실시간 알림, 커스텀 사운드, 알림 설정 연동' },
]

// 웹앱이 사이드카 실행 여부를 감지하는 로컬 포트 (변경 시 클라이언트 pushTokenSync.ts와 맞출 것)
const PING_PORT = 48620

// ─── 설정 로드 ────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(__dirname, 'config.json')
if (!fs.existsSync(CONFIG_PATH)) {
  console.error('[Sidecar] config.json이 없습니다. config.example.json을 복사해 작성하세요.')
  process.exit(1)
}
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
const { myUid, coupleId, appUrl, projectId } = config

// coupleId = 정렬된 두 uid를 '_'로 연결한 값 (uid에는 '_'가 없다)
const partnerUid = coupleId.split('_').find((u) => u !== myUid)

// ─── 단일 인스턴스 잠금 (중복 실행 시 중복 알림 방지) ─────────────────────

const LOCK_PATH = path.join(__dirname, 'sidecar.lock')
function acquireLock() {
  try {
    const existingPid = Number(fs.readFileSync(LOCK_PATH, 'utf8'))
    if (existingPid) {
      try {
        process.kill(existingPid, 0) // 살아있는지 확인만
        console.error(`[Sidecar] 이미 실행 중입니다 (PID ${existingPid}). 종료합니다.`)
        process.exit(0)
      } catch { /* 죽은 프로세스의 잔여 lock — 무시하고 진행 */ }
    }
  } catch { /* lock 파일 없음 — 정상 */ }
  fs.writeFileSync(LOCK_PATH, String(process.pid))
}
acquireLock()

// ─── 로그 (개인정보 본문은 기록하지 않는다) ──────────────────────────────

const LOG_PATH = path.join(__dirname, 'sidecar.log')
function log(event, extra = {}) {
  const line = `${new Date().toISOString()} ${event} ${JSON.stringify(extra)}`
  console.log(line)
  try { fs.appendFileSync(LOG_PATH, line + '\n') } catch { /* ignore */ }
}

// ─── 인증: Firebase CLI 로그인 토큰 재사용 (별도 시크릿 저장 없음) ────────

function buildAdcFile() {
  const configstorePath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json')
  if (!fs.existsSync(configstorePath)) {
    console.error('[Sidecar] firebase-tools 로그인 정보가 없습니다. `firebase login`을 먼저 실행하세요.')
    process.exit(1)
  }
  const store = JSON.parse(fs.readFileSync(configstorePath, 'utf8'))
  const refreshToken = store?.tokens?.refresh_token
  if (!refreshToken) {
    console.error('[Sidecar] refresh token이 없습니다. `firebase login`을 다시 실행하세요.')
    process.exit(1)
  }

  // Firebase CLI 공개 OAuth 클라이언트 (CLI 오픈소스에 포함된 공개 값)
  const adc = {
    type: 'authorized_user',
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: refreshToken,
  }

  const adcDir = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'tether-sidecar')
  fs.mkdirSync(adcDir, { recursive: true })
  const adcPath = path.join(adcDir, 'adc.json')
  fs.writeFileSync(adcPath, JSON.stringify(adc))
  return adcPath
}

process.env.GOOGLE_APPLICATION_CREDENTIALS = buildAdcFile()

const admin = require('firebase-admin')
admin.initializeApp({ projectId, credential: admin.credential.applicationDefault() })
const db = admin.firestore()

// ─── 알림 설정 (Firestore users 문서와 실시간 동기화) ─────────────────────

let settings = { message: true, status: true, diary: true, sound: 'waterDrop' }

const SOUND_FILES = {
  waterDrop: 'water-drop-20260621.wav',
  chime: 'chime.wav',
  sparkle: 'sparkle-20260625.wav',
  softBell: 'soft-bell-20260625.wav',
  gentleKnock: 'gentle-knock-20260625.wav',
}

function watchSettings() {
  db.doc(`users/${myUid}`).onSnapshot(
    (snap) => {
      const s = snap.data()?.notificationSettings
      if (s) {
        settings = { ...settings, ...s }
        log('settings_updated', { message: settings.message, status: settings.status, diary: settings.diary, sound: settings.sound })
      }
    },
    (err) => log('settings_listener_error', { message: err.message }),
  )
}

// ─── 사운드 재생 ──────────────────────────────────────────────────────────

function playSound() {
  if (settings.sound === 'silent') return
  const file = SOUND_FILES[settings.sound] || SOUND_FILES.waterDrop
  const wavPath = path.join(__dirname, '..', 'public', 'sounds', file)
  if (!fs.existsSync(wavPath)) return
  execFile('powershell.exe', [
    '-NoProfile', '-WindowStyle', 'Hidden', '-Command',
    `(New-Object Media.SoundPlayer '${wavPath}').PlaySync()`,
  ], () => { /* fire-and-forget */ })
}

// ─── 로컬 ping 서버 (웹앱이 사이드카 감지 → 자기 FCM 토큰 해제) ───────────

const http = require('http')

function startPingServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    // Chrome Private Network Access preflight (https 페이지 → localhost 요청 허용)
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Private-Network': 'true',
      })
      res.end()
      return
    }
    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, app: 'tether-sidecar', version: APP_VERSION }))
      return
    }
    res.writeHead(404)
    res.end()
  })
  server.on('error', (err) => log('ping_server_error', { message: err.message }))
  server.listen(PING_PORT, '127.0.0.1', () => log('ping_server_up', { port: PING_PORT }))
}

// ─── 포커스 감지 (Tether 창이 앞에 있으면 알림 억제) ──────────────────────

const FOCUS_PS_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class FG {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder t, int c);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@
$h = [FG]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[void][FG]::GetWindowText($h, $sb, 256)
$procId = 0
[void][FG]::GetWindowThreadProcessId($h, [ref]$procId)
$p = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
Write-Output "$p|$($sb.ToString())"
`

// 전경 창이 Tether PWA(chrome/msedge + 제목 Tether…)인지 확인한다
function isTetherFocused() {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', FOCUS_PS_SCRIPT], { timeout: 4000 }, (err, stdout) => {
      if (err) { resolve(false); return }
      const [proc, ...titleParts] = String(stdout).trim().split('|')
      const title = titleParts.join('|')
      const isBrowser = /^(chrome|msedge)$/i.test(proc ?? '')
      resolve(isBrowser && title.startsWith('Tether'))
    })
  })
}

// ─── 토스트 알림 ──────────────────────────────────────────────────────────

const notifier = require('node-notifier')
const ICON_PATH = path.join(__dirname, '..', 'public', 'icon-192.png')

async function showToast(title, body, screen) {
  if (await isTetherFocused()) {
    log('suppressed_focus', { screen })
    return
  }
  playSound()
  notifier.notify(
    {
      title,
      message: body || ' ',
      icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
      sound: false, // 커스텀 사운드를 직접 재생하므로 시스템음은 끈다
      appID: 'Tether',
      wait: true,
    },
    (err, response) => {
      if (err) { log('toast_error', { message: err.message }); return }
      if (response === 'activate') {
        exec(`start "" "${appUrl}/?screen=${screen}"`)
      }
    },
  )
}

// ─── Firestore 리스너 ─────────────────────────────────────────────────────

const startTime = new Date()

// 새 메시지: 시작 시점 이후 생성분만 구독해 초기 스냅샷 비용을 없앤다
function watchMessages() {
  db.collection(`couples/${coupleId}/messages`)
    .where('createdAt', '>', startTime)
    .onSnapshot(
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return
          const msg = change.doc.data()
          if (msg.senderUid === myUid) return
          if (settings.message === false) return
          const body = msg.type === 'image' ? '사진을 보냈어요 📸' : (msg.text ?? '')
          showToast('Tether 💌 새 메시지', body, 'chat')
          log('notify_message', {})
        })
      },
      (err) => {
        log('messages_listener_error', { message: err.message })
        setTimeout(watchMessages, 5000)
      },
    )
}

// 파트너 상태 변경: 첫 스냅샷은 기준값으로만 쓰고, 내용 무변경 write는 건너뛴다
function watchStatus() {
  let lastSeen = null
  db.doc(`couples/${coupleId}/status/${partnerUid}`).onSnapshot(
    (snap) => {
      if (!snap.exists) return
      const s = snap.data()
      const fingerprint = JSON.stringify([s.condition, s.message, s.mood ?? []])
      if (lastSeen === null) { lastSeen = fingerprint; return }
      if (fingerprint === lastSeen) return
      lastSeen = fingerprint
      if (settings.status === false) return
      const parts = []
      if (s.message) parts.push(s.message)
      if (Array.isArray(s.mood) && s.mood.length > 0) parts.push(s.mood.join(' · '))
      showToast('Tether 🌿 상태 업데이트', parts.join('\n') || '상태가 바뀌었어요', 'home')
      log('notify_status', {})
    },
    (err) => {
      log('status_listener_error', { message: err.message })
      setTimeout(watchStatus, 5000)
    },
  )
}

// 새 일기: 시작 시점 이후 생성분만
function watchDiary() {
  db.collection(`couples/${coupleId}/diary`)
    .where('createdAt', '>', startTime)
    .onSnapshot(
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return
          const diary = change.doc.data()
          if (diary.authorUid === myUid) return
          if (settings.diary === false) return
          showToast('Tether 💌 새 일기', '일기가 도착했어요', 'diary')
          log('notify_diary', {})
        })
      },
      (err) => {
        log('diary_listener_error', { message: err.message })
        setTimeout(watchDiary, 5000)
      },
    )
}

// ─── 시작 ─────────────────────────────────────────────────────────────────

log('sidecar_start', { version: APP_VERSION, partnerUid: `${partnerUid.slice(0, 6)}…` })
console.log(`Tether Sidecar v${APP_VERSION} — 알림 감시 시작`)
VERSION_HISTORY.forEach((v) => console.log(`  v${v.version} (${v.date}) ${v.summary}`))

startPingServer()
watchSettings()
watchMessages()
watchStatus()
watchDiary()

function cleanupAndExit() {
  log('sidecar_stop', {})
  try { fs.unlinkSync(LOCK_PATH) } catch { /* ignore */ }
  process.exit(0)
}
process.on('SIGINT', cleanupAndExit)
process.on('SIGTERM', cleanupAndExit)
