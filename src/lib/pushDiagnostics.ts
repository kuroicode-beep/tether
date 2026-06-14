// src/lib/pushDiagnostics.ts
// Cloud Function debugPushPing 호출 — 알림 연결 진단용
import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

export type PushPingTarget = 'self' | 'partner'

export type PushPingResult = {
  ok: boolean
  reason?: string
  target: PushPingTarget
  recipientUid?: string
  tokenCount: number
  successCount: number
  failureCount: number
}

// self 또는 partner 대상으로 테스트 알림 multicast를 발송한다
export async function debugPushPing(target: PushPingTarget = 'self'): Promise<PushPingResult> {
  const fn = httpsCallable<{ target: PushPingTarget }, PushPingResult>(functions, 'debugPushPing')
  const { data } = await fn({ target })
  return data
}
