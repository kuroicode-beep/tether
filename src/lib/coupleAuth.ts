// src/lib/coupleAuth.ts
// 사용자/커플 문서 관리 — 트랜잭션 기반의 안전한 커플 연결 보장
import { db } from './firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'

export type UserProfile = {
  uid: string
  nickname: string
  inviteCode: string
  coupleId: string | null
}

export type RestoredConnection = {
  uid: string
  coupleId: string
  myNickname: string
  partnerNickname: string
  partnerUid: string
  startDate?: string
}

// 6자리 영숫자 초대 코드 생성
export const generateInviteCode = (): string =>
  Math.random().toString(36).substring(2, 8).toUpperCase()

// users/{uid} 문서를 가져오거나 새로 만든다 — 기존 닉네임은 절대 자동으로 덮어쓰지 않는다
export const createOrGetUserDoc = async (
  uid: string,
  displayName?: string | null,
  nickname?: string,
): Promise<UserProfile & { isNew: boolean }> => {
  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)

  if (snap.exists()) {
    const data = snap.data() as Partial<UserProfile>
    const inviteCode = data.inviteCode || generateInviteCode()
    const existingNickname = (data.nickname ?? '').trim()

    // 기존 닉네임이 비어있거나 기본 placeholder('나')일 때만 새 닉네임을 적용한다
    const candidateNickname = (nickname?.trim() || displayName?.trim() || '').trim()
    const shouldApplyNickname =
      !!candidateNickname && (!existingNickname || existingNickname === '나')

    const profile: UserProfile = {
      uid,
      nickname: shouldApplyNickname ? candidateNickname : existingNickname || candidateNickname || '나',
      inviteCode,
      coupleId: data.coupleId ?? null,
    }

    const updates: Record<string, unknown> = {}
    if (!data.inviteCode) updates.inviteCode = inviteCode
    if (shouldApplyNickname) updates.nickname = profile.nickname

    if (Object.keys(updates).length > 0) {
      await setDoc(userRef, updates, { merge: true })
    }

    return { ...profile, isNew: false }
  }

  const initialNickname = (nickname?.trim() || displayName?.trim() || '나').trim() || '나'
  const profile: UserProfile = {
    uid,
    nickname: initialNickname,
    inviteCode: generateInviteCode(),
    coupleId: null,
  }

  await setDoc(userRef, {
    ...profile,
    fcmToken: null,
    notificationSettings: {
      message: true,
      status: true,
      diary: true,
    },
    createdAt: serverTimestamp(),
  })

  return { ...profile, isNew: true }
}

// 닉네임 시작 흐름에서 호출되는 진입점 — 초대 코드를 반환한다
export const createUserProfile = async (
  uid: string,
  nickname: string,
  displayName?: string | null,
): Promise<string> => {
  const profile = await createOrGetUserDoc(uid, displayName, nickname)
  return profile.inviteCode
}

// 초대 코드로 상대방 사용자를 검색
export const findUserByInviteCode = async (
  code: string,
): Promise<{ uid: string; nickname: string } | null> => {
  const q = query(collection(db, 'users'), where('inviteCode', '==', code))
  const snap = await getDocs(q)
  if (snap.empty) return null

  const first = snap.docs[0]
  const data = first.data() as Partial<UserProfile>
  return {
    uid: first.id,
    nickname: data.nickname || '상대방',
  }
}

export const findUserByCode = findUserByInviteCode

// users/{uid} 문서를 안전하게 조회한다
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data() as Partial<UserProfile>
  return {
    uid,
    nickname: data.nickname ?? '',
    inviteCode: data.inviteCode ?? '',
    coupleId: data.coupleId ?? null,
  }
}

export const getMyCoupleId = async (uid: string): Promise<string | null> => {
  const profile = await getUserProfile(uid)
  return profile?.coupleId ?? null
}

const toIsoDate = (value: unknown): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'object' && 'toDate' in value) {
    const timestamp = value as { toDate?: () => Date }
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString().split('T')[0]
    }
  }
  return undefined
}

// users/{uid}.coupleId를 기반으로 커플 정보 + 파트너 닉네임을 복원한다
export const restoreConnectionFromProfile = async (
  uid: string,
): Promise<RestoredConnection | null> => {
  const profile = await getUserProfile(uid)
  if (!profile?.coupleId) return null

  const coupleSnap = await getDoc(doc(db, 'couples', profile.coupleId))
  if (!coupleSnap.exists()) return null

  const couple = coupleSnap.data()
  const members = Array.isArray(couple.members) ? couple.members as string[] : []
  const partnerUid = members.find((member) => member !== uid)
  if (!partnerUid) return null

  let partnerNickname = '상대방'
  try {
    const partner = await getUserProfile(partnerUid)
    if (partner?.nickname) partnerNickname = partner.nickname
  } catch {
    // 파트너 문서를 읽을 수 없어도 커플 복원 자체는 성공시킨다
  }

  return {
    uid,
    coupleId: profile.coupleId,
    myNickname: profile.nickname || '나',
    partnerNickname,
    partnerUid,
    startDate: toIsoDate(couple.startDate) ?? toIsoDate(couple.createdAt),
  }
}

// 두 사용자를 단일 트랜잭션으로 같은 커플에 묶는다 — race condition을 차단한다
export const connectCouple = async (myUid: string, partnerUid: string): Promise<string> => {
  if (myUid === partnerUid) {
    throw new Error('SELF_INVITE')
  }

  const members = [myUid, partnerUid].sort()
  const coupleId = members.join('_')
  const coupleRef = doc(db, 'couples', coupleId)
  const myRef = doc(db, 'users', myUid)
  const partnerRef = doc(db, 'users', partnerUid)

  await runTransaction(db, async (tx) => {
    // 모든 read를 write보다 먼저 수행한다 — Firestore 트랜잭션 규칙
    const coupleSnap = await tx.get(coupleRef)
    const mySnap = await tx.get(myRef)
    const partnerSnap = await tx.get(partnerRef)

    if (!mySnap.exists()) {
      throw new Error('MY_USER_DOC_MISSING')
    }
    if (!partnerSnap.exists()) {
      throw new Error('PARTNER_USER_DOC_MISSING')
    }

    // Firestore rules가 create/update를 명확히 판별할 수 있도록 모드를 분리한다
    if (!coupleSnap.exists()) {
      tx.set(coupleRef, {
        members,
        createdAt: serverTimestamp(),
      })
    } else {
      tx.update(coupleRef, { members })
    }

    // 두 사용자 문서 모두 update — rules의 update 분기로 평가된다
    tx.update(myRef, { coupleId })
    tx.update(partnerRef, { coupleId })
  })

  return coupleId
}

export const linkCouple = connectCouple

// 코드 생성자가 본인 user 문서의 coupleId 업데이트를 실시간으로 감지한다
export const waitForCoupleConnection = (
  uid: string,
  onConnected: (coupleId: string) => void,
) => {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    const coupleId = snap.data()?.coupleId
    if (typeof coupleId === 'string' && coupleId.length > 0) {
      onConnected(coupleId)
    }
  })
}
