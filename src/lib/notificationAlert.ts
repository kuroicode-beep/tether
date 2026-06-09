// src/lib/notificationAlert.ts
// 포그라운드 FCM 수신 시 소리 + 시스템 알림 (Android PWA)
import type { NotificationSettings } from '../hooks/usePushNotification'

let audioCtx: AudioContext | null = null

// 짧은 알림음 2회 재생 (Web Audio — 별도 파일 없이 동작)
export function playNotificationSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return

    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') void audioCtx.resume()

    const beep = (startAt: number, freq: number) => {
      const osc = audioCtx!.createOscillator()
      const gain = audioCtx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, startAt)
      gain.gain.exponentialRampToValueAtTime(0.35, startAt + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22)
      osc.connect(gain)
      gain.connect(audioCtx!.destination)
      osc.start(startAt)
      osc.stop(startAt + 0.24)
    }

    const t = audioCtx.currentTime
    beep(t, 880)
    beep(t + 0.28, 660)

    if ('vibrate' in navigator) {
      navigator.vibrate([120, 60, 120])
    }
  } catch {
    /* ignore */
  }
}

// 앱이 열려 있을 때도 Android에서 소리/알림이 나도록 시스템 Notification 표시
export function showSystemNotification(title: string, body: string, tag?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  try {
    const n = new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag ?? 'tether-alert',
      silent: false,
      renotify: true,
    } as NotificationOptions)
    n.onclick = () => {
      window.focus()
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
