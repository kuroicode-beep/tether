// src/lib/omokSound.ts
// 오목 효과음 — WebAudio 합성이라 파일이 필요 없다 (notificationAlert.ts 패턴)
let audioCtx: AudioContext | null = null

// 공용 AudioContext — 첫 호출 때 만들고, 일시정지 상태면 깨운다
function getCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

// 단음 하나를 짧게 낸다
function tone(
  ctx: AudioContext,
  type: OscillatorType,
  freqStart: number,
  freqEnd: number,
  startAt: number,
  duration: number,
  volume: number,
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freqStart, startAt)
  if (freqEnd !== freqStart) osc.frequency.exponentialRampToValueAtTime(freqEnd, startAt + duration)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

// 돌 놓는 소리 — 짧은 "딱" + 낮은 울림
export function playStoneSound() {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, 'triangle', 1400, 900, t, 0.05, 0.25)
  tone(ctx, 'sine', 260, 180, t, 0.12, 0.18)
}

// 초읽기 틱 — 마지막 10초, 5초 이하는 더 높고 크게
export function playTickSound(urgent: boolean) {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, 'sine', urgent ? 1320 : 880, urgent ? 1320 : 880, t, 0.07, urgent ? 0.22 : 0.12)
}

// 시간 초과 — 내려가는 톤
export function playTimeoutSound() {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, 'sawtooth', 620, 180, t, 0.35, 0.2)
}

// 승리 — 올라가는 세 음
export function playWinSound() {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, 'sine', 523, 523, t, 0.14, 0.22)
  tone(ctx, 'sine', 659, 659, t + 0.12, 0.14, 0.22)
  tone(ctx, 'sine', 784, 784, t + 0.24, 0.22, 0.24)
}
