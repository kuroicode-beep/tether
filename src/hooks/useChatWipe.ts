// src/hooks/useChatWipe.ts
// 채팅 기록 전체 삭제 — 메시지 · 첨부 인덱스 · Storage 첨부 실물을 순서대로 비운다.
// 세 군데를 모두 지워야 대화가 완전히 사라진다. 하나라도 남으면 라이브러리 목록이나
// 첨부 URL로 내용이 계속 보인다.
import { useCallback, useState } from 'react'
import { collection, getCountFromServer, getDocs, limit, query, writeBatch } from 'firebase/firestore'
import { deleteObject, listAll, ref } from 'firebase/storage'
import { db, storage } from '../lib/firebase'

// writeBatch 한 번에 담을 문서 수 (Firestore 한도 500보다 낮게 잡는다)
const BATCH_SIZE = 400
// 지울 채팅 하위 컬렉션
const CHAT_COLLECTIONS = ['messages', 'files'] as const
// 지울 Storage 하위 경로 (교환일기 · 사진앨범 등 다른 경로는 건드리지 않는다)
const CHAT_STORAGE_DIRS = ['images', 'files'] as const

export type ChatWipePhase = 'idle' | 'counting' | 'messages' | 'files' | 'storage' | 'done' | 'error'

export interface ChatWipeProgress {
  phase: ChatWipePhase
  done: number
  total: number
  message: string
}

const IDLE: ChatWipeProgress = { phase: 'idle', done: 0, total: 0, message: '' }

// 컬렉션을 배치 단위로 끝까지 비운다
async function deleteCollection(
  path: string,
  onStep: (removed: number) => void,
): Promise<number> {
  let removed = 0
  for (;;) {
    const snap = await getDocs(query(collection(db, path), limit(BATCH_SIZE)))
    if (snap.empty) break
    const batch = writeBatch(db)
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref))
    await batch.commit()
    removed += snap.size
    onStep(removed)
    // 마지막 페이지면 더 돌 필요가 없다
    if (snap.size < BATCH_SIZE) break
  }
  return removed
}

// Storage 폴더를 하위까지 훑어 파일을 지운다 (uploaderUid 하위 폴더 구조까지 포함)
async function deleteStorageTree(path: string, onStep: () => void): Promise<void> {
  const listed = await listAll(ref(storage, path))
  for (const item of listed.items) {
    try {
      await deleteObject(item)
      onStep()
    } catch (err) {
      // 이미 지워졌거나 권한이 없는 파일 하나 때문에 전체가 멈추지 않게 한다
      console.warn('[chatWipe] storage delete skipped', item.fullPath, err)
    }
  }
  for (const prefix of listed.prefixes) {
    await deleteStorageTree(prefix.fullPath, onStep)
  }
}

// 채팅 전체 삭제를 실행하는 훅 — 진행 상태를 화면에 그대로 보여준다
export function useChatWipe(coupleId: string | null) {
  const [progress, setProgress] = useState<ChatWipeProgress>(IDLE)

  const reset = useCallback(() => setProgress(IDLE), [])

  const wipe = useCallback(async (): Promise<boolean> => {
    if (!coupleId) {
      setProgress({ phase: 'error', done: 0, total: 0, message: '커플 연결 정보를 찾을 수 없어요.' })
      return false
    }

    try {
      setProgress({ phase: 'counting', done: 0, total: 0, message: '지울 대화를 세는 중...' })
      const counts = await Promise.all(
        CHAT_COLLECTIONS.map(async (name) => {
          const snap = await getCountFromServer(collection(db, 'couples', coupleId, name))
          return snap.data().count
        }),
      )
      const total = counts.reduce((sum, n) => sum + n, 0)

      let done = 0
      for (const [index, name] of CHAT_COLLECTIONS.entries()) {
        const base = done
        const phase: ChatWipePhase = name === 'messages' ? 'messages' : 'files'
        const label = name === 'messages' ? '대화를 지우는 중' : '파일 목록을 지우는 중'
        setProgress({ phase, done, total, message: `${label}...` })
        await deleteCollection(`couples/${coupleId}/${name}`, (removed) => {
          setProgress({
            phase,
            done: base + removed,
            total,
            message: `${label}... ${base + removed} / ${total}`,
          })
        })
        done = base + counts[index]
      }

      let storageRemoved = 0
      setProgress({ phase: 'storage', done: total, total, message: '사진·파일을 지우는 중...' })
      for (const dir of CHAT_STORAGE_DIRS) {
        await deleteStorageTree(`couples/${coupleId}/${dir}`, () => {
          storageRemoved += 1
          setProgress({
            phase: 'storage',
            done: total,
            total,
            message: `사진·파일을 지우는 중... ${storageRemoved}개`,
          })
        })
      }

      setProgress({
        phase: 'done',
        done: total,
        total,
        message: `대화 ${total}건과 사진·파일 ${storageRemoved}개를 지웠어요.`,
      })
      return true
    } catch (err) {
      console.warn('[chatWipe] failed', err)
      setProgress({
        phase: 'error',
        done: 0,
        total: 0,
        message: '삭제 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.',
      })
      return false
    }
  }, [coupleId])

  const running = progress.phase !== 'idle' && progress.phase !== 'done' && progress.phase !== 'error'

  return { progress, running, wipe, reset }
}
