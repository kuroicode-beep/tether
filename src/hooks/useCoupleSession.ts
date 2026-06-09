// src/hooks/useCoupleSession.ts
// SessionContext thin wrapper — Firestore coupleId는 connected 상태에서만 노출
import { useSession } from '../context/SessionContext'

export function useCoupleSession() {
  const session = useSession()
  const connected = session.status === 'connected' && session.connection != null

  return {
    uid: session.uid,
    coupleId: connected ? session.connection!.coupleId : null,
    partnerUid: connected ? session.connection!.partnerUid : null,
    isLoading: session.isLoading,
    isSynced: connected,
  }
}
