// src/lib/notificationAlert.ts
// 포그라운드 FCM 수신 시 소리 + 시스템 알림 (Android PWA)
import type { NotificationSettings } from '../hooks/usePushNotification'

export const NOTIFICATION_SOUND_URL = '/sounds/chime.wav'
export const SW_PLAY_SOUND_MESSAGE = 'PLAY_NOTIFICATION_SOUND'
export const SW_NAVIGATE_MESSAGE = 'NAVIGATE'

let audioCtx: AudioContext | null = null
let chimeAudio: HTMLAudioElement | null = null

// 차임 오디오 엘리먼트를 준비한다
function getChimeAudio(): HTMLAudioElement {
  if (!chimeAudio) {
    chimeAudio = new Audio(NOTIFICATION_SOUND_URL)
    chimeAudio.preload = 'auto'
  }
  return chimeAudio
}

// 종소리(차임) 한 번 울림 — Web Audio 폴백
function playBellStrike(ctx: AudioContext, startAt: number, fundamental: number, volume = 1) {
  const partials = [
    { ratio: 0.5, amp: 0.42, decay: 1.9 },
    { ratio: 1, amp: 1, decay: 1.7 },
    { ratio: 2.01, amp: 0.58, decay: 1.15 },
    { ratio: 2.62, amp: 0.32, decay: 0.9 },
    { ratio: 3.48, amp: 0.16, decay: 0.6 },
  ]

  for (const partial of partials) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = fundamental * partial.ratio
    const peak = 0.18 * partial.amp * volume
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), startAt + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + partial.decay)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(startAt)
    osc.stop(startAt + partial.decay + 0.08)
  }
}

// Web Audio로 딩-동 차임을 합성한다 (파일 재생 실패 시)
function playSyntheticChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return

    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') void audioCtx.resume()

    const t = audioCtx.currentTime
    playBellStrike(audioCtx, t, 659, 1)
    playBellStrike(audioCtx, t + 0.38, 880, 0.95)
    playBellStrike(audioCtx, t + 0.78, 1175, 0.72)
  } catch {
    /* ignore */
  }
}

// Tether 차임 알림음 재생
export function playNotificationSound() {
  try {
    const audio = getChimeAudio()
    audio.currentTime = 0
    void audio.play().catch(() => playSyntheticChime())

    if ('vibrate' in navigator) {
      navigator.vibrate([180, 80, 180, 80, 240])
    }
  } catch {
    playSyntheticChime()
  }
}

// 앱이 백그라운드일 때만 시스템 알림 표시
export function showSystemNotification(
  title: string,
  body: string,
  tag?: string,
  onClick?: () => void,
) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible') return

  try {
    const n = new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag ?? 'tether-alert',
      silent: false,
      renotify: true,
      requireInteraction: true,
      vibrate: [220, 100, 220, 100, 320],
    } as NotificationOptions)
    n.onclick = () => {
      window.focus()
      onClick?.()
      n.close()
    }
  } catch {
    /* ignore */
  }
}

export function shouldAlertForType(
  type: string | undefined,
  settings: NotificationSettings,
): boolean {
  if (!type) return true
  if (type === 'message') return settings.message !== false
  if (type === 'status') return settings.status !== false
  if (type === 'diary') return settings.diary !== false
  return true
}

// 알림 URL에서 screen 쿼리 파라미터를 추출한다
export function screenFromNotificationUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.searchParams.get('screen')
  } catch {
    return null
  }
}
