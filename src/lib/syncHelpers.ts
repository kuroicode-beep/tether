// src/lib/syncHelpers.ts
// Firestore 스냅샷과 optimistic 로컬 항목 병합 유틸

export function isOptimisticId(id: string): boolean {
  return id.startsWith('opt_')
}

export function readClientId(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const value = (data as { clientId?: unknown }).clientId
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

// blob URL이면 해제한다
export function revokeBlobUrl(url: string | null | undefined) {
  if (url?.startsWith('blob:')) {
    try { URL.revokeObjectURL(url) } catch { /* ignore */ }
  }
}

// 서버 문서와 매칭된 pending 항목을 제거한다 (clientId 우선, fallback 매처)
export function reconcilePending<T extends { id: string; clientId?: string }, S>(
  pending: Map<string, T>,
  serverItems: S[],
  isMatch: (pending: T, server: S) => boolean,
  getServerClientId: (server: S) => string | undefined = (server) =>
    readClientId(server as unknown),
) {
  for (const server of serverItems) {
    const serverClientId = getServerClientId(server)
    for (const [id, item] of [...pending.entries()]) {
      const hasClientIdPair = !!item.clientId && !!serverClientId
      const clientIdMatch = hasClientIdPair && item.clientId === serverClientId
      const fallbackMatch = !item.clientId && !serverClientId && isMatch(item, server)
      if (clientIdMatch || fallbackMatch) {
        pending.delete(id)
        const maybeUrl = (item as { imageUrl?: string }).imageUrl
        revokeBlobUrl(maybeUrl)
      }
    }
  }
}

// createdAt 내림차순 병합 (사진첩·일기 등)
export function mergeByCreatedAtDesc<T extends { id: string; createdAt: number | null }>(
  server: T[],
  pending: T[],
): T[] {
  const merged = [...pending, ...server]
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of merged.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

// 채팅: older + live + pending(미매칭) 시간순
export function mergeChatMessages<T extends { id: string; createdAt: number | null }>(
  older: T[],
  live: T[],
  pending: T[],
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of [...older, ...live, ...pending]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
}

// 히스토리: date 내림차순
export function mergeByDateDesc<T extends { id: string; date: number }>(
  server: T[],
  pending: T[],
): T[] {
  const merged = [...pending, ...server]
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of merged.sort((a, b) => b.date - a.date)) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}
