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
import type {
  RelayBackgroundNote, RelayNovel, RelayNovelStatus, RelayNovelTurn,
} from '../lib/relayNovel'

function toNovel(id: string, d: Record<string, unknown>): RelayNovel {
  const startedAt = d['startedAt'] as Timestamp | null
  const completedAt = d['completedAt'] as Timestamp | null
  return {
    id,
    title: (d['title'] as string) || '제목 없는 이야기',
    background: (d['background'] as RelayBackgroundNote[]) ?? [],
    resetVotes: (d['resetVotes'] as string[]) ?? [],
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
      background: [],
      resetVotes: [],
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
      background: [],
      resetVotes: [],
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
      // 이야기가 이어지면 남아 있던 초기화 동의는 무효로 본다
      resetVotes: [],
    })
  }, [coupleId])

  // 초기화 동의. 둘 다 모이면 본문과 설정을 비우고 처음 상태로 되돌린다.
  const voteReset = useCallback(async (
    novel: RelayNovel,
    myUid2: string,
    partnerUid: string | null,
  ): Promise<'pending' | 'done'> => {
    if (!coupleId) return 'pending'
    const ref = doc(db, 'couples', coupleId, 'relayNovels', novel.id)
    const votes = new Set(novel.resetVotes)
    votes.add(myUid2)

    const bothAgreed = !!partnerUid && votes.has(partnerUid) && votes.has(myUid2)
    if (!bothAgreed) {
      await updateDoc(ref, { resetVotes: [...votes] })
      return 'pending'
    }

    await updateDoc(ref, {
      turns: [],
      turnCount: 0,
      background: [],
      resetVotes: [],
      status: 'active' as RelayNovelStatus,
      nextTurnUid: myUid2,
    })
    return 'done'
  }, [coupleId])

  // 제목 변경 — 차례와 무관하게 둘 다 언제든 바꿀 수 있다
  const setTitle = useCallback(async (novelId: string, title: string) => {
    if (!coupleId) return
    await updateDoc(doc(db, 'couples', coupleId, 'relayNovels', novelId), {
      title: title.trim().slice(0, 60) || '제목 없는 이야기',
    })
  }, [coupleId])

  // 배경 설정 추가 — 차례와 무관하게 둘 다 언제든 더할 수 있다
  const addBackground = useCallback(async (
    novelId: string,
    text: string,
    byName: string,
  ): Promise<RelayBackgroundNote | null> => {
    if (!coupleId) return null
    const note: RelayBackgroundNote = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: text.trim().slice(0, 500),
      byName,
      at: Date.now(),
    }
    if (!note.text) return null
    await updateDoc(doc(db, 'couples', coupleId, 'relayNovels', novelId), {
      background: arrayUnion(note),
    })
    return note
  }, [coupleId])

  // 배경 설정 삭제 — arrayRemove는 정확한 객체가 필요하므로 목록을 다시 쓴다
  const removeBackground = useCallback(async (
    novelId: string,
    current: RelayBackgroundNote[],
    noteId: string,
  ) => {
    if (!coupleId) return
    await updateDoc(doc(db, 'couples', coupleId, 'relayNovels', novelId), {
      background: current.filter((note) => note.id !== noteId),
    })
  }, [coupleId])

  // DeepSeek 이어쓰기. API 키는 서버에만 있으므로 Cloud Function을 거친다.
  const requestAssist = useCallback(async (target: RelayNovel): Promise<string> => {
    if (!coupleId) throw new Error('no_couple')
    setAssisting(true)
    try {
      const call = httpsCallable<
        { coupleId: string; title: string; background: string[]; turns: string[] },
        { text: string }
      >(functions, 'relayNovelAssist')
      const res = await call({
        coupleId,
        title: target.title,
        background: target.background.map((note) => note.text),
        turns: target.turns.map((t) => t.text),
      })
      return res.data.text
    } finally {
      setAssisting(false)
    }
  }, [coupleId])

  return {
    novel, assisting, start, setStatus, appendTurn, requestAssist,
    setTitle, addBackground, removeBackground, voteReset,
  }
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
