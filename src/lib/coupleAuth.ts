// src/lib/coupleAuth.ts
// 사용자/커플 문서 관리 — invite 토큰 + Cloud Function claim 기반 안전 연결
import { db, functions, storage } from './firebase'
import { httpsCallable } from 'firebase/functions'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

export type UserProfile = {
  uid: string
  nickname: string
  inviteCode: string
  coupleId: string | null
  photoUrl: string | null
  approved?: boolean
}

export type RestoredConnection = {
  uid: string
  coupleId: string
  myNickname: string
  partnerNickname: string
  partnerUid: string
  startDate?: string
  myPhotoUrl?: string | null
  partnerPhotoUrl?: string | null
}

export type ClaimInviteResult = {
  coupleId: string
  partnerUid: string
}

export const ADMIN_EMAIL = 'kuroicode@gmail.com'

export function isAdminEmail(email?: string | null): boolean {
  return (email ?? '').trim().toLowerCase() === ADMIN_EMAIL
}

// 6자리 영숫자 초대 코드 생성
export const generateInviteCode = (): string =>
  Math.random().toString(36).substring(2, 8).toUpperCase()

// Cloud Function HttpsError를 클라이언트 에러 코드로 변환한다
const mapClaimError = (error: unknown): never => {
  const err = error as { code?: string; message?: string; details?: unknown }
  const message = String(err.message ?? '')

  if (message.includes('invalid_code') || err.code === 'functions/not-found') {
    throw new Error('invalid_code')
  }
  if (message.includes('already_used')) {
    throw new Error('already_used')
  }
  if (message.includes('self_connect')) {
    throw new Error('self_connect')
  }
  if (message.includes('already_linked')) {
    throw new Error('already_linked')
  }
  throw error instanceof Error ? error : new Error('claim_failed')
}

// users/{uid} 문서를 가져오거나 새로 만든다 — 기존 닉네임은 절대 자동으로 덮어쓰지 않는다
export const createOrGetUserDoc = async (
  uid: string,
  displayName?: string | null,
  nickname?: string,
  email?: string | null,
): Promise<UserProfile & { isNew: boolean }> => {
  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)

  if (snap.exists()) {
    const data = snap.data() as Partial<UserProfile>
    const inviteCode = data.inviteCode || generateInviteCode()
    const existingNickname = (data.nickname ?? '').trim()

    const candidateNickname = (nickname?.trim() || displayName?.trim() || '').trim()
    const shouldApplyNickname =
      !!candidateNickname && (!existingNickname || existingNickname === '나')

    const profile: UserProfile = {
      uid,
      nickname: shouldApplyNickname ? candidateNickname : existingNickname || candidateNickname || '나',
      inviteCode,
      coupleId: data.coupleId ?? null,
      photoUrl: data.photoUrl ?? null,
      approved: data.approved,
    }

    const updates: Record<string, unknown> = {}
    if (!data.inviteCode) updates.inviteCode = inviteCode
    if (shouldApplyNickname) updates.nickname = profile.nickname

    if (Object.keys(updates).length > 0) {
      await setDoc(userRef, updates, { merge: true })
    }
    await syncPublicProfile(uid, profile.nickname)

    return { ...profile, isNew: false }
  }

  const initialNickname = (nickname?.trim() || displayName?.trim() || '나').trim() || '나'
  const profile: UserProfile = {
    uid,
    nickname: initialNickname,
    inviteCode: generateInviteCode(),
    coupleId: null,
    photoUrl: null,
  }

  await setDoc(userRef, {
    ...profile,
    email: email?.trim().toLowerCase() ?? null,
    approved: isAdminEmail(email),
    approvedAt: isAdminEmail(email) ? serverTimestamp() : null,
    role: isAdminEmail(email) ? 'admin' : 'member',
    fcmToken: null,
    notificationSettings: {
      message: true,
      status: true,
      diary: true,
      sound: 'waterDrop',
    },
    createdAt: serverTimestamp(),
  })
  await syncPublicProfile(uid, profile.nickname)

  return { ...profile, isNew: true }
}

// invites/{code} 1회용 토큰을 생성하고 users 문서 표시용 코드를 갱신한다
export const createInvite = async (myUid: string): Promise<string> => {
  const code = generateInviteCode()
  await setDoc(doc(db, 'invites', code), {
    fromUid: myUid,
    code,
    createdAt: serverTimestamp(),
    claimed: false,
  })
  await updateDoc(doc(db, 'users', myUid), { inviteCode: code })
  return code
}

// 닉네임 시작 흐름 — user 문서 생성 후 invite 토큰 발급
export const createUserProfile = async (
  uid: string,
  nickname: string,
  displayName?: string | null,
): Promise<string> => {
  await createOrGetUserDoc(uid, displayName, nickname)
  return createInvite(uid)
}

// invites/{code}에서 상대방 정보를 조회한다
export const findUserByInviteCode = async (
  code: string,
): Promise<{ uid: string; nickname: string } | null> => {
  const normalized = code.toUpperCase().trim()
  const inviteSnap = await getDoc(doc(db, 'invites', normalized))
  if (!inviteSnap.exists()) return null

  const invite = inviteSnap.data()
  if (invite?.claimed) return null

  const fromUid = invite?.fromUid as string | undefined
  if (!fromUid) return null

  const publicSnap = await getDoc(doc(db, 'publicProfiles', fromUid))
  if (publicSnap.exists()) {
    const nickname = (publicSnap.data()?.nickname as string | undefined)?.trim()
    return { uid: fromUid, nickname: nickname || '상대방' }
  }

  const profile = await getUserProfile(fromUid)
  if (!profile) return null

  return {
    uid: fromUid,
    nickname: profile.nickname || '상대방',
  }
}

export const findUserByCode = findUserByInviteCode

// publicProfiles/{uid}에 닉네임을 동기화한다 — 초대 미리보기용
const syncPublicProfile = async (uid: string, nickname: string) => {
  const trimmed = nickname.trim()
  if (!trimmed) return
  await setDoc(doc(db, 'publicProfiles', uid), { nickname: trimmed }, { merge: true })
}

// Updates the user's nickname in both private profile and public invite preview profile.
export const updateUserNickname = async (uid: string, nickname: string) => {
  const trimmed = nickname.trim()
  if (!trimmed) return
  await updateDoc(doc(db, 'users', uid), { nickname: trimmed })
  await syncPublicProfile(uid, trimmed)
}

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
    photoUrl: data.photoUrl ?? null,
    approved: data.approved,
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
  let partnerPhotoUrl: string | null = null
  try {
    const partner = await getUserProfile(partnerUid)
    if (partner?.nickname) partnerNickname = partner.nickname
    partnerPhotoUrl = partner?.photoUrl ?? null
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
    myPhotoUrl: profile.photoUrl ?? null,
    partnerPhotoUrl,
  }
}

// Uploads and publishes the user's profile photo to private and public profile docs.
export const updateUserProfilePhoto = async (uid: string, file: File): Promise<string> => {
  const safeName = file.name.replace(/[^\w.-]+/g, '_') || 'profile.jpg'
  const storageRef = ref(storage, `users/${uid}/profile/${Date.now()}_${safeName}`)
  await uploadBytes(storageRef, file, { contentType: file.type || 'image/jpeg' })
  const photoUrl = await getDownloadURL(storageRef)
  await updateDoc(doc(db, 'users', uid), { photoUrl })
  await setDoc(doc(db, 'publicProfiles', uid), { photoUrl }, { merge: true })
  return photoUrl
}

// invite 코드 claim — Cloud Function(Admin SDK)으로 couple 생성 + 양쪽 coupleId 설정
export const claimInviteAndConnect = async (
  myUid: string,
  code: string,
): Promise<ClaimInviteResult> => {
  const normalized = code.toUpperCase().trim()
  const inviteSnap = await getDoc(doc(db, 'invites', normalized))
  if (!inviteSnap.exists()) throw new Error('invalid_code')

  const invite = inviteSnap.data()
  if (invite?.claimed) throw new Error('already_used')
  if (invite?.fromUid === myUid) throw new Error('self_connect')

  try {
    const claimInviteFn = httpsCallable<{ code: string }, ClaimInviteResult>(
      functions,
      'claimInvite',
    )
    const { data } = await claimInviteFn({ code: normalized })
    if (!data?.coupleId || !data?.partnerUid) {
      throw new Error('claim_failed')
    }
    return data
  } catch (error) {
    return mapClaimError(error)
  }
}

// 커플 연결 해제 — Cloud Function(Admin SDK)으로 양쪽 users.coupleId를 null 처리한다
export const disconnectCouple = async (): Promise<void> => {
  const disconnectCoupleFn = httpsCallable<void, { ok: boolean }>(
    functions,
    'disconnectCouple',
  )
  await disconnectCoupleFn()
}

/** @deprecated claimInviteAndConnect 사용 — 클라이언트 cross-write 차단됨 */
export const connectCouple = async (_myUid: string, _partnerUid: string): Promise<string> => {
  throw new Error('connectCouple is deprecated — use claimInviteAndConnect')
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
