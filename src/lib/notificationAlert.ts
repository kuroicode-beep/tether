// src/lib/notificationAlert.ts
// 포그라운드 FCM 수신 시 소리 + 시스템 알림 (Android PWA)
import type { NotificationSettings } from '../hooks/usePushNotification'

export const NOTIFICATION_SOUND_URL = '/sounds/water-drop-20260621.wav'
export const CHIME_SOUND_URL = '/sounds/chime.wav'
export const SW_PLAY_SOUND_MESSAGE = 'PLAY_NOTIFICATION_SOUND'
export const SW_NAVIGATE_MESSAGE = 'NAVIGATE'

let audioCtx: AudioContext | null = null
let chimeAudio: HTMLAudioElement | null = null
let soundUrl = NOTIFICATION_SOUND_URL

// 차임 오디오 엘리먼트를 준비한다
function getChimeAudio(): HTMLAudioElement {
  if (!chimeAudio) {
    chimeAudio = new Audio(soundUrl)
    chimeAudio.preload = 'auto'
  }
  return chimeAudio
}

// 물방울 한 번 떨어지는 소리 — Web Audio 폴백
function playWaterDrop(ctx: AudioContext, startAt: number, baseFreq: number, volume = 1) {
  const osc = ctx.createOscillator()
  const harmonic = ctx.createOscillator()
  const click = ctx.createOscillator()
  const toneGain = ctx.createGain()
  const clickGain = ctx.createGain()

  osc.type = 'sine'
  harmonic.type = 'sine'
  click.type = 'triangle'
  osc.frequency.setValueAtTime(baseFreq + 420, startAt)
  osc.frequency.exponentialRampToValueAtTime(baseFreq, startAt + 0.08)
  harmonic.frequency.setValueAtTime((baseFreq + 420) * 1.92, startAt)
  harmonic.frequency.exponentialRampToValueAtTime(baseFreq * 1.92, startAt + 0.08)
  click.frequency.setValueAtTime(1850, startAt)

  toneGain.gain.setValueAtTime(0.0001, startAt)
  toneGain.gain.exponentialRampToValueAtTime(0.34 * volume, startAt + 0.008)
  toneGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.42)
  clickGain.gain.setValueAtTime(0.22 * volume, startAt)
  clickGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.04)

  osc.connect(toneGain)
  harmonic.connect(toneGain)
  click.connect(clickGain)
  toneGain.connect(ctx.destination)
  clickGain.connect(ctx.destination)
  osc.start(startAt)
  harmonic.start(startAt)
  click.start(startAt)
  osc.stop(startAt + 0.48)
  harmonic.stop(startAt + 0.48)
  click.stop(startAt + 0.05)
}

// Web Audio로 물방울 소리를 합성한다 (파일 재생 실패 시)
function playSyntheticWaterDrop() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return

    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') void audioCtx.resume()

    const t = audioCtx.currentTime
    playWaterDrop(audioCtx, t, 680, 1)
    playWaterDrop(audioCtx, t + 0.18, 920, 0.72)
  } catch {
    /* ignore */
  }
}

// Tether 물방울 알림음 재생
export function playNotificationSound(sound: NotificationSettings['sound'] = 'waterDrop') {
  if (sound === 'silent') return
  const nextUrl = sound === 'chime' ? CHIME_SOUND_URL : NOTIFICATION_SOUND_URL
  if (soundUrl !== nextUrl) {
    soundUrl = nextUrl
    chimeAudio = null
  }
  try {
    const audio = getChimeAudio()
    audio.currentTime = 0
    void audio.play().catch(() => playSyntheticWaterDrop())

    if ('vibrate' in navigator) {
      navigator.vibrate([180, 80, 180, 80, 240])
    }
  } catch {
    playSyntheticWaterDrop()
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
