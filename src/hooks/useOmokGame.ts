// src/hooks/useOmokGame.ts
// 오목 게임 세션 — 최신 게임 1건 구독, 시작/착수/기권/정산 (useRelayNovel 패턴 미러)
import { useState, useEffect, useCallback } from 'react'
import {
  collection, doc, query, where, orderBy, limit, onSnapshot,
  addDoc, updateDoc, setDoc, serverTimestamp, arrayUnion, increment,
  Timestamp, DocumentData,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import {
  OMOK_BOARD_SIZE, OMOK_MAX_MOVES, buildBoard, checkWin, isOccupied,
  type OmokGame, type OmokMove, type OmokResult,
} from '../lib/omok'

// Firestore 문서 → 도메인 객체
function toGame(id: string, d: DocumentData): OmokGame {
  return {
    id,
    type: 'omok',
    status: d['status'] ?? 'active',
    boardSize: d['boardSize'] ?? OMOK_BOARD_SIZE,
    moves: (d['moves'] as OmokMove[]) ?? [],
    moveCount: (d['moveCount'] as number) ?? 0,
    nextTurnUid: d['nextTurnUid'] ?? '',
    blackUid: d['blackUid'] ?? '',
    bet: (d['bet'] as number) ?? 0,
    escrowUids: (d['escrowUids'] as string[]) ?? [],
    startedBy: d['startedBy'] ?? '',
    startedAt: (d['startedAt'] as Timestamp | null)?.toMillis() ?? null,
    finishedAt: (d['finishedAt'] as Timestamp | null)?.toMillis() ?? null,
    winnerUid: d['winnerUid'] ?? null,
    result: (d['result'] as OmokResult | null) ?? null,
    winLine: (d['winLine'] as OmokGame['winLine']) ?? null,
    settled: d['settled'] === true,
  }
}

export type PlaceOutcome =
  | { ok: true; state: 'placed' | 'win' | 'draw' }
  | { ok: false; reason: 'not-turn' | 'occupied' | 'balance' | 'inactive' | 'error' }

export function useOmokGame(coupleId: string | null, myUid: string | null, partnerUid: string | null) {
  // 최신 게임 1건(상태 무관) — 종료 직후에도 양쪽이 최종 판을 볼 수 있게 한다
  const [latestGame, setLatestGame] = useState<OmokGame | null>(null)

  useEffect(() => {
    if (!coupleId) {
      setLatestGame(null)
      return
    }
    const q = query(
      collection(db, 'couples', coupleId, 'games'),
      where('type', '==', 'omok'),
      orderBy('startedAt', 'desc'),
      limit(1),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const d = snap.docs[0]
        setLatestGame(d ? toGame(d.id, d.data()) : null)
      },
      (err) => console.warn('[useOmokGame] listener error', err),
    )
    return () => unsub()
  }, [coupleId])

  const activeGame = latestGame?.status === 'active' ? latestGame : null

  // 내 지갑 잔액 증감 (정산·에스크로 공용)
  const adjustWallet = useCallback(async (uid: string, delta: number) => {
    if (!coupleId || delta === 0) return
    await updateDoc(doc(db, 'couples', coupleId, 'wallets', uid), {
      balance: increment(delta),
      updatedAt: serverTimestamp(),
    })
  }, [coupleId])

  // 전적 이력 + 누적 통계 기록 (게임을 끝내는 클라이언트만 호출)
  const recordResult = useCallback(async (game: OmokGame, result: OmokResult, winnerUid: string | null) => {
    if (!coupleId || !myUid || !partnerUid) return
    const loserUid = winnerUid == null ? null : (winnerUid === myUid ? partnerUid : myUid)
    await addDoc(collection(db, 'couples', coupleId, 'gameResults'), {
      game: 'omok',
      winnerUid,
      loserUid,
      draw: result === 'draw',
      bet: game.bet,
      result,
      finishedAt: serverTimestamp(),
    })
    const net = winnerUid && loserUid
      ? { [winnerUid]: increment(game.bet), [loserUid]: increment(-game.bet) }
      : {}
    await setDoc(doc(db, 'couples', coupleId, 'gameStats', 'omok'), {
      total: increment(1),
      draws: increment(result === 'draw' ? 1 : 0),
      ...(winnerUid ? { wins: { [winnerUid]: increment(1) } } : {}),
      ...(Object.keys(net).length > 0 ? { net } : {}),
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }, [coupleId, myUid, partnerUid])

  // 새 판 시작 — 시작자가 흑·선공, 판돈 에스크로 차감
  const start = useCallback(async (bet: number): Promise<string | null> => {
    if (!coupleId || !myUid) return null
    try {
      const ref = await addDoc(collection(db, 'couples', coupleId, 'games'), {
        type: 'omok',
        status: 'active',
        boardSize: OMOK_BOARD_SIZE,
        moves: [],
        moveCount: 0,
        nextTurnUid: myUid,
        blackUid: myUid,
        bet,
        escrowUids: [myUid],
        startedBy: myUid,
        startedAt: serverTimestamp(),
        finishedAt: null,
        winnerUid: null,
        result: null,
        winLine: null,
        settled: false,
      })
      await adjustWallet(myUid, -bet)
      return ref.id
    } catch (err) {
      console.warn('[useOmokGame] start failed', err)
      return null
    }
  }, [coupleId, myUid, adjustWallet])

  // 착수 — 첫 수면 에스크로(수락), 5목이면 승리 정산, 225수면 무승부 정산
  const placeStone = useCallback(async (
    game: OmokGame, x: number, y: number, myBalance: number | null,
  ): Promise<PlaceOutcome> => {
    if (!coupleId || !myUid || !partnerUid) return { ok: false, reason: 'error' }
    if (game.status !== 'active') return { ok: false, reason: 'inactive' }
    if (game.nextTurnUid !== myUid) return { ok: false, reason: 'not-turn' }

    const board = buildBoard(game.moves, game.boardSize)
    if (isOccupied(board, x, y)) return { ok: false, reason: 'occupied' }

    const needsEscrow = !game.escrowUids.includes(myUid)
    if (needsEscrow && game.bet > 0 && (myBalance ?? 0) < game.bet) {
      return { ok: false, reason: 'balance' }
    }

    const move: OmokMove = { x, y, uid: myUid, at: Date.now() }
    board[y][x] = myUid
    const winLine = checkWin(board, move)
    const isDraw = !winLine && game.moveCount + 1 >= OMOK_MAX_MOVES
    const gameRef = doc(db, 'couples', coupleId, 'games', game.id)

    try {
      await updateDoc(gameRef, {
        moves: arrayUnion(move),
        moveCount: increment(1),
        nextTurnUid: partnerUid,
        ...(needsEscrow ? { escrowUids: arrayUnion(myUid) } : {}),
        ...(winLine ? {
          status: 'finished', winnerUid: myUid, result: 'five',
          winLine, finishedAt: serverTimestamp(), settled: true,
        } : {}),
        ...(isDraw ? {
          status: 'finished', winnerUid: null, result: 'draw',
          finishedAt: serverTimestamp(), settled: true,
        } : {}),
      })
      if (needsEscrow) await adjustWallet(myUid, -game.bet)

      // 정산 — 게임을 끝내는 쓰기를 한 이 클라이언트만 수행한다 (이중 지급 방지)
      if (winLine) {
        await adjustWallet(myUid, game.bet * 2)
        await recordResult(game, 'five', myUid)
        return { ok: true, state: 'win' }
      }
      if (isDraw) {
        await adjustWallet(myUid, game.bet)
        await adjustWallet(partnerUid, game.bet)
        await recordResult(game, 'draw', null)
        return { ok: true, state: 'draw' }
      }
      return { ok: true, state: 'placed' }
    } catch (err) {
      console.warn('[useOmokGame] placeStone failed', err)
      return { ok: false, reason: 'error' }
    }
  }, [coupleId, myUid, partnerUid, adjustWallet, recordResult])

  // 기권 — 상대가 수락(에스크로) 전이면 취소·환불, 이후면 상대 승 정산
  const surrender = useCallback(async (game: OmokGame): Promise<'surrendered' | 'cancelled' | null> => {
    if (!coupleId || !myUid || !partnerUid || game.status !== 'active') return null
    const gameRef = doc(db, 'couples', coupleId, 'games', game.id)
    const partnerEscrowed = game.escrowUids.includes(partnerUid)
    try {
      if (!partnerEscrowed) {
        await updateDoc(gameRef, {
          status: 'abandoned', result: 'cancelled', winnerUid: null,
          finishedAt: serverTimestamp(), settled: true,
        })
        if (game.escrowUids.includes(myUid)) await adjustWallet(myUid, game.bet)
        return 'cancelled'
      }
      await updateDoc(gameRef, {
        status: 'finished', result: 'surrender', winnerUid: partnerUid,
        finishedAt: serverTimestamp(), settled: true,
      })
      await adjustWallet(partnerUid, game.bet * 2)
      await recordResult(game, 'surrender', partnerUid)
      return 'surrendered'
    } catch (err) {
      console.warn('[useOmokGame] surrender failed', err)
      return null
    }
  }, [coupleId, myUid, partnerUid, adjustWallet, recordResult])

  return { latestGame, activeGame, start, placeStone, surrender }
}
