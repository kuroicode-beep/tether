// sidecar/index.js
// Tether Windows 알림 사이드카 — Firestore 실시간 리스너 → 네이티브 토스트 + 커스텀 사운드
// FCM/크롬 경로를 우회해 알림 안정성을 보장한다.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile, exec, spawn } = require('child_process')

const APP_VERSION = '0.4.0'
const VERSION_HISTORY = [
  { version: '0.4.0', date: '2026-08-07', summary: '채팅 입력창 포커스 시 IME를 한글 모드로 자동 전환 (/ime/hangul)' },
  { version: '0.3.2', date: '2026-07-26', summary: '이미 열린 잠금 화면도 단축키로 해제, 단축키로 여는 채팅창은 다크모드' },
  { version: '0.3.1', date: '2026-07-26', summary: '단축키로 열 때 PIN 건너뛰기(1회용 로컬 토큰), 포트 기반 단일 인스턴스 판정' },
  { version: '0.3.0', date: '2026-07-26', summary: '전역 단축키(기본 Win+Alt+Q)로 채팅 화면 바로 열기' },
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

// 채팅 화면을 여는 전역 단축키 (config.hotkey로 변경, false면 비활성화)
const DEFAULT_HOTKEY = 'Win+Alt+Q'
const hotkeyConfig = config.hotkey === undefined ? DEFAULT_HOTKEY : config.hotkey

// coupleId = 정렬된 두 uid를 '_'로 연결한 값 (uid에는 '_'가 없다)
const partnerUid = coupleId.split('_').find((u) => u !== myUid)

// ─── 단일 인스턴스 판정 ───────────────────────────────────────────────────
// PID 파일로는 판정하지 않는다. 프로세스가 비정상 종료되면 lock이 남고,
// Windows가 그 PID를 다른 프로세스에 재사용하면 살아있는 것으로 오판해
// 사이드카가 영영 뜨지 않는다. 실제 판정은 PING_PORT 바인딩으로 한다.
// lock 파일은 진단용 기록으로만 남긴다.

const LOCK_PATH = path.join(__dirname, 'sidecar.lock')
function writeLockFile() {
  try { fs.writeFileSync(LOCK_PATH, String(process.pid)) } catch { /* ignore */ }
}

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

// ─── 단축키 잠금 해제 토큰 ────────────────────────────────────────────────
// 단축키로 채팅을 열 때 PIN을 건너뛰기 위한 1회용 토큰.
// 이 PC에서 단축키를 실제로 누른 경우에만 발급되고, 검증은 127.0.0.1로만
// 가능하므로 다른 기기에서는 URL을 알아도 잠금을 풀 수 없다.

const crypto = require('crypto')

const UNLOCK_TOKEN_TTL_MS = 30_000
const unlockTokens = new Map() // token → 만료 시각

// 만료된 토큰을 정리한다
function pruneUnlockTokens() {
  const now = Date.now()
  for (const [token, expiresAt] of unlockTokens) {
    if (expiresAt <= now) unlockTokens.delete(token)
  }
}

// 30초간 유효한 1회용 토큰을 만든다
function issueUnlockToken() {
  pruneUnlockTokens()
  const token = crypto.randomBytes(24).toString('hex')
  unlockTokens.set(token, Date.now() + UNLOCK_TOKEN_TTL_MS)
  return token
}

// 토큰을 검증하고 즉시 폐기한다 (재사용 불가)
function consumeUnlockToken(token) {
  pruneUnlockTokens()
  if (!token || !unlockTokens.has(token)) return false
  unlockTokens.delete(token)
  return true
}

// 이미 열려 있는 창을 포커스한 경우 — 그 창은 URL을 새로 받지 않으므로
// 잠금 해제 요청을 짧게 보관해두고, 잠금 화면에 있는 앱이 가져가게 한다.
let pendingUnlockUntil = 0

function markUnlockPending() {
  pendingUnlockUntil = Date.now() + UNLOCK_TOKEN_TTL_MS
}

function consumeUnlockPending() {
  if (Date.now() > pendingUnlockUntil) return false
  pendingUnlockUntil = 0
  return true
}

// ─── 로컬 ping 서버 (웹앱이 사이드카 감지 → 자기 FCM 토큰 해제) ───────────

const http = require('http')

// 포트 바인딩이 곧 단일 인스턴스 판정이다. 성공하면 onReady로 나머지를 시작한다.
function startPingServer(onReady) {
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
    // 채팅 입력창 포커스 시 전경 Tether 창의 IME를 한글 모드로 전환한다
    if (req.method === 'GET' && req.url === '/ime/hangul') {
      setImeHangul().then((ok) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      })
      return
    }
    // 잠금 화면에 있는 앱이 "방금 단축키가 눌렸는지"를 가져간다
    if (req.method === 'GET' && req.url === '/unlock-pending') {
      const ok = consumeUnlockPending()
      if (ok) log('unlock_pending_consumed', {})
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok }))
      return
    }
    // 단축키로 발급한 토큰 검증 — 성공 시 앱이 PIN을 건너뛴다
    if (req.method === 'GET' && req.url.startsWith('/unlock?')) {
      const token = new URL(req.url, `http://127.0.0.1:${PING_PORT}`).searchParams.get('token')
      const ok = consumeUnlockToken(token)
      log('unlock_verify', { ok })
      res.writeHead(ok ? 200 : 403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok }))
      return
    }
    res.writeHead(404)
    res.end()
  })
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Sidecar] 이미 실행 중입니다 (포트 ${PING_PORT} 사용 중). 종료합니다.`)
      process.exit(0)
    }
    log('ping_server_error', { message: err.message })
  })
  server.listen(PING_PORT, '127.0.0.1', () => {
    log('ping_server_up', { port: PING_PORT })
    onReady()
  })
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

// ─── IME 한글 전환 (채팅 입력창 포커스 연동) ──────────────────────────────

// 전경 창이 Tether일 때만 그 창의 IME를 한글 모드로 바꾼다 (ime-hangul.ps1)
function setImeHangul() {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'ime-hangul.ps1')
    execFile('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath,
    ], { timeout: 4000 }, (err, stdout) => {
      const ok = !err && String(stdout).includes('OK:1')
      log('ime_hangul', { ok })
      resolve(ok)
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

// ─── 전역 단축키 → 채팅 화면 열기 ─────────────────────────────────────────

const HOTKEY_MODIFIERS = { alt: 1, ctrl: 2, control: 2, shift: 4, win: 8 }
const MOD_NOREPEAT = 0x4000

// "Win+Alt+Q" 형태를 RegisterHotKey 인자로 변환한다
function parseHotkey(spec) {
  const parts = String(spec).split('+').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null

  const keyPart = parts[parts.length - 1]
  const modifierParts = parts.slice(0, -1)

  let modifiers = MOD_NOREPEAT
  for (const part of modifierParts) {
    const bit = HOTKEY_MODIFIERS[part.toLowerCase()]
    if (!bit) return null
    modifiers |= bit
  }

  // 영문 한 글자 또는 F1~F12만 지원한다
  let vk = null
  if (/^[A-Za-z0-9]$/.test(keyPart)) {
    vk = keyPart.toUpperCase().charCodeAt(0)
  } else if (/^F([1-9]|1[0-2])$/i.test(keyPart)) {
    vk = 0x70 + Number(keyPart.slice(1)) - 1
  }
  if (vk === null) return null

  return { modifiers, vk }
}

// 열려 있는 Tether 창을 앞으로 가져오고, 없으면 채팅 화면으로 새로 연다
function openChat() {
  const scriptPath = path.join(__dirname, 'focus-window.ps1')
  execFile('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath,
  ], { timeout: 5000 }, (err, stdout) => {
    const focused = !err && String(stdout).includes('FOUND:1')
    if (focused) {
      // 창은 이미 떠 있으므로 URL을 새로 줄 수 없다.
      // 잠금 화면이라면 앱이 이 요청을 가져가 스스로 잠금을 푼다.
      markUnlockPending()
      log('hotkey_focus_existing', {})
      return
    }
    // 1회용 토큰을 붙여 열면 앱이 로컬 검증 후 PIN을 건너뛴다.
    // theme=dark — 단축키로 여는 채팅창은 다크모드로 띄운다.
    const token = issueUnlockToken()
    exec(`start "" "${appUrl}/?screen=chat&unlock=${token}&theme=dark"`)
    log('hotkey_open_new', {})
  })
}

// PowerShell 리스너를 띄우고 HOTKEY 신호를 받는다 (네이티브 모듈 의존 없음)
function startHotkeyListener() {
  if (hotkeyConfig === false || hotkeyConfig === null || hotkeyConfig === '') {
    log('hotkey_disabled', {})
    return
  }

  const parsed = parseHotkey(hotkeyConfig)
  if (!parsed) {
    log('hotkey_parse_failed', { spec: String(hotkeyConfig) })
    console.error(`[Sidecar] 단축키 형식을 읽을 수 없습니다: ${hotkeyConfig} (예: Win+Alt+Q)`)
    return
  }

  const scriptPath = path.join(__dirname, 'hotkey.ps1')
  const child = spawn('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath,
    '-Modifiers', String(parsed.modifiers), '-Key', String(parsed.vk),
  ], { windowsHide: true })

  let buffer = ''
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const signal = line.trim()
      if (signal === 'HOTKEY') {
        openChat()
      } else if (signal === 'READY') {
        log('hotkey_registered', { spec: hotkeyConfig })
        console.log(`  단축키 ${hotkeyConfig} → 채팅 화면 열기`)
      } else if (signal.startsWith('ERROR:register_failed')) {
        log('hotkey_register_failed', { spec: hotkeyConfig, detail: signal })
        console.error(`[Sidecar] 단축키 ${hotkeyConfig} 등록 실패 — 다른 프로그램이 사용 중일 수 있습니다.`)
      }
    }
  })

  child.on('error', (err) => log('hotkey_listener_error', { message: err.message }))
  child.on('exit', (code) => {
    log('hotkey_listener_exit', { code })
    // 비정상 종료 시에만 재시작 (정상 종료 코드 0은 등록 실패 후 종료 등)
    if (code !== 0 && !shuttingDown) setTimeout(startHotkeyListener, 5000)
  })

  hotkeyChild = child
}

let hotkeyChild = null
let shuttingDown = false

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

// 포트를 잡는 데 성공한 인스턴스만 실제 감시를 시작한다
startPingServer(() => {
  writeLockFile()
  startHotkeyListener()
  watchSettings()
  watchMessages()
  watchStatus()
  watchDiary()
})

function cleanupAndExit() {
  shuttingDown = true
  log('sidecar_stop', {})
  try { hotkeyChild?.kill() } catch { /* ignore */ }
  try { fs.unlinkSync(LOCK_PATH) } catch { /* ignore */ }
  process.exit(0)
}
process.on('SIGINT', cleanupAndExit)
process.on('SIGTERM', cleanupAndExit)
