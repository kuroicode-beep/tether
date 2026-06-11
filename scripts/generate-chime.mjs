// scripts/generate-chime.mjs — Tether 알림 차임 WAV 생성
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'

const sampleRate = 44100
const duration = 2.4
const samples = Math.floor(sampleRate * duration)
const buffer = new Float32Array(samples)

// 큰 종소리 배음 합성으로 한 번 울리는 소리를 만든다
function addBellStrike(startSec, fundamental, volume) {
  const partials = [
    { ratio: 0.5, amp: 0.42, decay: 1.9 },
    { ratio: 1, amp: 1.0, decay: 1.7 },
    { ratio: 2.01, amp: 0.58, decay: 1.15 },
    { ratio: 2.62, amp: 0.32, decay: 0.9 },
    { ratio: 3.48, amp: 0.16, decay: 0.6 },
  ]
  const start = Math.floor(startSec * sampleRate)

  for (let i = start; i < samples; i++) {
    const t = (i - start) / sampleRate
    let sample = 0
    for (const partial of partials) {
      const env = Math.exp(-t / partial.decay)
      sample += partial.amp * Math.sin(2 * Math.PI * fundamental * partial.ratio * t) * env
    }
    buffer[i] += sample * volume * 0.48
  }
}

addBellStrike(0, 659, 1.0)
addBellStrike(0.38, 880, 0.95)
addBellStrike(0.78, 1175, 0.72)

let peak = 0
for (let i = 0; i < samples; i++) {
  peak = Math.max(peak, Math.abs(buffer[i]))
}
const normalize = peak > 0 ? Math.min(1 / peak, 1.15) : 1

const pcm = Buffer.alloc(samples * 2)
for (let i = 0; i < samples; i++) {
  const boosted = Math.tanh(buffer[i] * normalize * 1.35)
  const clamped = Math.max(-1, Math.min(1, boosted))
  pcm.writeInt16LE(Math.round(clamped * 32767), i * 2)
}

const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + pcm.length, 4)
header.write('WAVE', 8)
header.write('fmt ', 12)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20)
header.writeUInt16LE(1, 22)
header.writeUInt32LE(sampleRate, 24)
header.writeUInt32LE(sampleRate * 2, 28)
header.writeUInt16LE(2, 32)
header.writeUInt16LE(16, 34)
header.write('data', 36)
header.writeUInt32LE(pcm.length, 40)

const outPath = resolve('public/sounds/chime.wav')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, Buffer.concat([header, pcm]))
console.log('Wrote', outPath)
