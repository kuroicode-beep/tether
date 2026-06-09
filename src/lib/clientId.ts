// src/lib/clientId.ts
// optimistic write와 Firestore 문서를 1:1로 매칭하는 clientId 생성

export function createClientId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomUUID()}`
}

export function createOptimisticId(clientId: string): string {
  return `opt_${clientId}`
}
