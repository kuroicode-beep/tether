// src/hooks/useRelayNovel.ts
// 릴레이소설 세션 상태와 조작. 진행 중인 세션 1개를 구독하고,
// 완결본 목록은 서재 화면에서 따로 읽는다.
import { useCallback, useEffect, useState } from 'react'
import {
  addDoc, arrayUnion, collection, doc, getDocs, increment,
  limit, onSnapshot, orderBy, query, Timestamp, updateDoc, where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../lib/firebase'
import type { RelayNovel, RelayNovelStatus, RelayNovelTurn } from '../lib/relayNovel'

function toNovel(id: string, d: Record<string, unknown>): RelayNovel {
  const startedAt = d['startedAt'] as Timestamp | null
  const completedAt = d['completedAt'] as Timestamp | null
  return {
    id,
    title: (d['title'] as string) || '제목 없는 이야기',
    status: (d['status'] as RelayNovelStatus) ?? 'active',
    turns: (d['turns'] as RelayNovelTurn[]) ?? [],
    turnCount: (d['turnCount'] as number) ?? 0,
    nextTurnUid: (d['nextTurnUid'] as string) ?? (d['startedBy'] as string) ?? '',
    startedBy: (d['startedBy'] as string) ?? '',
    startedAt: startedAt?.toMillis() ?? null,
    completedAt: completedAt?.toMillis() ?? null,
  }
}

// 진행 중(active·paused) 세션을 구독한다. 없으면 null.
export function useRelayNovel(coupleId: string | null, myUid: string | null) {
  const [novel, setNovel] = useState<RelayNovel | null>(null)
  const [assisting, setAssisting] = useState(false)

  useEffect(() => {
    if (!coupleId) {
      setNovel(null)
      return
    }
    const q = query(
      collection(db, 'couples', coupleId, 'relayNovels'),
      where('status', 'in', ['active', 'paused']),
      limit(1),
    )
    return onSnapshot(
      q,
      (snap) => {
        const first = snap.docs[0]
        setNovel(first ? toNovel(first.id, first.data()) : null)
      },
      (err) => console.warn('[useRelayNovel] listener error', err),
    )
  }, [coupleId])

  // 새 세션을 연다. 이미 진행 중이면 호출한 쪽에서 막는다.
  const start = useCallback(async (title: string): Promise<RelayNovel | null> => {
    if (!coupleId || !myUid) return null
    const ref = await addDoc(collection(db, 'couples', coupleId, 'relayNovels'), {
      title: title.trim() || '제목 없는 이야기',
      status: 'active' as RelayNovelStatus,
      turns: [],
      turnCount: 0,
      // 시작한 사람이 첫 턴을 쓴다
      nextTurnUid: myUid,
      startedBy: myUid,
      startedAt: Timestamp.now(),
      completedAt: null,
    })
    return {
      id: ref.id,
      title: title.trim() || '제목 없는 이야기',
      status: 'active',
      turns: [],
      turnCount: 0,
      nextTurnUid: myUid,
      startedBy: myUid,
      startedAt: Date.now(),
      completedAt: null,
    }
  }, [coupleId, myUid])

  const setStatus = useCallback(async (novelId: string, status: RelayNovelStatus) => {
    if (!coupleId) return
    await updateDoc(doc(db, 'couples', coupleId, 'relayNovels', novelId), {
      status,
      ...(status === 'completed' ? { completedAt: Timestamp.now() } : {}),
    })
  }, [coupleId])

  // 한 턴을 소설 문서에 덧붙이고 차례를 상대에게 넘긴다.
  // (서재에서 채팅 페이지네이션과 무관하게 읽기 위해 문서에도 함께 쌓는다)
  const appendTurn = useCallback(async (
    novelId: string,
    turn: RelayNovelTurn,
    nextTurnUid: string,
  ) => {
    if (!coupleId) return
    await updateDoc(doc(db, 'couples', coupleId, 'relayNovels', novelId), {
      turns: arrayUnion(turn),
      turnCount: increment(1),
      nextTurnUid,
    })
  }, [coupleId])

  // DeepSeek 이어쓰기. API 키는 서버에만 있으므로 Cloud Function을 거친다.
  const requestAssist = useCallback(async (target: RelayNovel): Promise<string> => {
    if (!coupleId) throw new Error('no_couple')
    setAssisting(true)
    try {
      const call = httpsCallable<
        { coupleId: string; title: string; turns: string[] },
        { text: string }
      >(functions, 'relayNovelAssist')
      const res = await call({
        coupleId,
        title: target.title,
        turns: target.turns.map((t) => t.text),
      })
      return res.data.text
    } finally {
      setAssisting(false)
    }
  }, [coupleId])

  return { novel, assisting, start, setStatus, appendTurn, requestAssist }
}

// 서재 화면용 — 완결본을 최신순으로 읽는다
export async function fetchCompletedNovels(coupleId: string): Promise<RelayNovel[]> {
  const q = query(
    collection(db, 'couples', coupleId, 'relayNovels'),
    where('status', '==', 'completed'),
    orderBy('completedAt', 'desc'),
    limit(50),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => toNovel(d.id, d.data()))
}
