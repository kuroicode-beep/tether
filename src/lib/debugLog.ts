// src/lib/debugLog.ts
// 전체 검증용 런타임 로그 (debug session fefa38)
const INGEST =
  'http://127.0.0.1:7277/ingest/53f00146-dd6a-4063-8d94-9e1764ff34ab'
const SESSION_ID = 'fefa38'

// 검증 로그를 로컬 수집 서버로 전송한다
export function debugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'verify',
) {
  const payload = {
    sessionId: SESSION_ID,
    location,
    message,
    data,
    timestamp: Date.now(),
    hypothesisId,
    runId,
  }
  // #region agent log
  fetch(INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify(payload),
  }).catch(() => {})
  // #endregion
}
