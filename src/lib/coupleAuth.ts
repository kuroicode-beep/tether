import { db } from './firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
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

export const generateInviteCode = (): string =>
  Math.random().toString(36).substring(2, 8).toUpperCase()

export const createOrGetUserDoc = async (
  uid: string,
  displayName?: string | null,
  nickname?: string,
): Promise<UserProfile & { isNew: boolean }> => {
  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)
  const resolvedNickname = displayName?.trim() || nickname?.trim() || '나'

  if (snap.exists()) {
    const data = snap.data() as Partial<UserProfile>
    const inviteCode = data.inviteCode || generateInviteCode()
    const shouldUpdateNickname = !!nickname?.trim() && (!data.nickname || data.nickname === '나')
    const profile: UserProfile = {
      uid,
      nickname: shouldUpdateNickname ? resolvedNickname : data.nickname || resolvedNickname,
      inviteCode,
      coupleId: data.coupleId ?? null,
    }

    if (!data.inviteCode || !data.nickname || shouldUpdateNickname) {
      await setDoc(userRef, profile, { merge: true })
    }

    return { ...profile, isNew: false }
  }

  const profile: UserProfile = {
    uid,
    nickname: resolvedNickname,
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

export const createUserProfile = async (
  uid: string,
  nickname: string,
  displayName?: string | null,
): Promise<string> => {
  const profile = await createOrGetUserDoc(uid, displayName, nickname)
  return profile.inviteCode
}

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

  const partner = await getUserProfile(partnerUid)
  return {
    uid,
    coupleId: profile.coupleId,
    myNickname: profile.nickname || '나',
    partnerNickname: partner?.nickname || '상대방',
    partnerUid,
    startDate: toIsoDate(couple.startDate) ?? toIsoDate(couple.createdAt),
  }
}

export const connectCouple = async (myUid: string, partnerUid: string): Promise<string> => {
  const coupleId = [myUid, partnerUid].sort().join('_')

  await setDoc(doc(db, 'couples', coupleId), {
    members: [myUid, partnerUid],
    anniversaries: [],
    createdAt: serverTimestamp(),
  }, { merge: true })

  await Promise.all([
    updateDoc(doc(db, 'users', myUid), { coupleId }),
    updateDoc(doc(db, 'users', partnerUid), { coupleId }),
  ])

  return coupleId
}

export const linkCouple = connectCouple

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
