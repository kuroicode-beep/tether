// scripts/generate-chime.mjs — Tether 알림 물방울 WAV 생성
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'

const sampleRate = 44100
const duration = 1.15
const samples = Math.floor(sampleRate * duration)
const buffer = new Float32Array(samples)

function addDrop(startSec, baseFreq, volume) {
  const start = Math.floor(startSec * sampleRate)
  const dropLength = Math.floor(0.62 * sampleRate)

  for (let n = 0; n < dropLength && start + n < samples; n++) {
    const i = start + n
    const t = n / sampleRate
    const env = Math.exp(-t / 0.18)
    const clickEnv = Math.exp(-t / 0.018)
    const pitch = baseFreq + 420 * Math.exp(-t / 0.055)
    const tone =
      Math.sin(2 * Math.PI * pitch * t)
      + 0.38 * Math.sin(2 * Math.PI * pitch * 1.92 * t + 0.5)
      + 0.22 * Math.sin(2 * Math.PI * pitch * 2.74 * t)
    const click = Math.sin(2 * Math.PI * 1850 * t) * clickEnv
    buffer[i] += (tone * env * 0.58 + click * 0.34) * volume
  }
}

function addTinyRoom() {
  const delay = Math.floor(0.055 * sampleRate)
  for (let i = delay; i < samples; i++) {
    buffer[i] += buffer[i - delay] * 0.18 * Math.exp(-(i - delay) / sampleRate / 0.9)
  }
}

addDrop(0.02, 680, 1.15)
addDrop(0.19, 920, 0.82)
addTinyRoom()

let peak = 0
for (let i = 0; i < samples; i++) {
  peak = Math.max(peak, Math.abs(buffer[i]))
}
const normalize = peak > 0 ? 1 / peak : 1

const pcm = Buffer.alloc(samples * 2)
for (let i = 0; i < samples; i++) {
  const t = i / sampleRate
  const fadeOut = t > duration - 0.08 ? Math.max(0, (duration - t) / 0.08) : 1
  const boosted = Math.tanh(buffer[i] * normalize * 1.55) * fadeOut
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
console.log('Wrote water drop notification sound to', outPath)
