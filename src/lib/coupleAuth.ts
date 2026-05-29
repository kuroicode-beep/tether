import { db, auth } from './firebase'
import {
  collection, doc, setDoc, query,
  where, getDocs, updateDoc, serverTimestamp,
  getDoc,
} from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'

type UserProfile = {
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

export const getOrCreateUid = async (): Promise<string> => {
  try {
    if (!auth) throw new Error('auth not configured')
    const result = await signInAnonymously(auth)
    return result.user.uid
  } catch {
    let uid = localStorage.getItem('tether_uid')
    if (!uid) {
      uid = crypto.randomUUID()
      localStorage.setItem('tether_uid', uid)
    }
    return uid
  }
}

export const createUserProfile = async (
  uid: string,
  nickname: string,
  displayName?: string | null
): Promise<string> => {
  const resolvedNickname = displayName?.trim() || nickname
  const inviteCode = generateInviteCode()
  const profile = { uid, nickname: resolvedNickname, inviteCode, coupleId: null }
  try {
    const userRef = doc(db, 'users', uid)
    const snap = await getDoc(userRef)
    if (snap.exists()) {
      const existing = snap.data() as Partial<UserProfile>
      const existingProfile = {
        uid,
        nickname: existing.nickname ?? resolvedNickname,
        inviteCode: existing.inviteCode ?? inviteCode,
        coupleId: existing.coupleId ?? null,
      }
      localStorage.setItem('tether_user_profile', JSON.stringify(existingProfile))
      return existingProfile.inviteCode
    }

    await setDoc(userRef, {
      uid,
      nickname: resolvedNickname,
      inviteCode,
      coupleId: null,
      fcmToken: null,
      notificationSettings: {
        message: true,
        status: true,
        diary: true,
      },
      createdAt: serverTimestamp(),
    })
  } catch {
    // Firebase 미설정 시 localStorage fallback
  }
  localStorage.setItem('tether_user_profile', JSON.stringify(profile))
  return inviteCode
}

export const getMyProfile = (): { uid: string; nickname: string; inviteCode: string } | null => {
  const stored = localStorage.getItem('tether_user_profile')
  return stored ? JSON.parse(stored) : null
}

export const findUserByCode = async (
  code: string
): Promise<{ uid: string; nickname: string } | null> => {
  try {
    const q = query(collection(db, 'users'), where('inviteCode', '==', code))
    const snap = await getDocs(q)
    if (!snap.empty) {
      const d = snap.docs[0].data()
      return { uid: snap.docs[0].id, nickname: d.nickname as string }
    }
  } catch {
    // Firebase 미설정 — null 반환
  }
  return null
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    if (!snap.exists()) return null
    const data = snap.data() as Partial<UserProfile>
    return {
      uid,
      nickname: data.nickname ?? '',
      inviteCode: data.inviteCode ?? '',
      coupleId: data.coupleId ?? null,
    }
  } catch {
    const local = getMyProfile()
    return local?.uid === uid ? { ...local, coupleId: null } : null
  }
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
  uid: string
): Promise<RestoredConnection | null> => {
  const profile = await getUserProfile(uid)
  if (!profile?.coupleId) return null

  try {
    const coupleSnap = await getDoc(doc(db, 'couples', profile.coupleId))
    const couple = coupleSnap.exists() ? coupleSnap.data() : {}
    const members = Array.isArray(couple.members) ? couple.members as string[] : []
    const partnerUid = members.find((member) => member !== uid)
    if (!partnerUid) return null

    const partner = await getUserProfile(partnerUid)
    return {
      uid,
      coupleId: profile.coupleId,
      myNickname: profile.nickname,
      partnerNickname: partner?.nickname || '자기',
      partnerUid,
      startDate: toIsoDate(couple.startDate) ?? toIsoDate(couple.createdAt),
    }
  } catch {
    return null
  }
}

export const linkCouple = async (myUid: string, partnerUid: string): Promise<string> => {
  const coupleId = [myUid, partnerUid].sort().join('_')
  try {
    await setDoc(doc(db, 'couples', coupleId), {
      members: [myUid, partnerUid],
      createdAt: serverTimestamp(),
    })
    await updateDoc(doc(db, 'users', myUid), { coupleId })
    await updateDoc(doc(db, 'users', partnerUid), { coupleId })
  } catch {
    // localStorage fallback
  }
  localStorage.setItem('tether_couple_id', coupleId)
  localStorage.setItem('tether_partner_uid', partnerUid)
  return coupleId
}
