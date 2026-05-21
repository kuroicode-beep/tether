import { db, auth } from './firebase'
import {
  collection, doc, setDoc, query,
  where, getDocs, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'

export const generateInviteCode = (): string =>
  Math.random().toString(36).substring(2, 8).toUpperCase()

export const getOrCreateUid = async (): Promise<string> => {
  try {
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

export const createUserProfile = async (uid: string, nickname: string): Promise<string> => {
  const inviteCode = generateInviteCode()
  const profile = { uid, nickname, inviteCode, coupleId: null }
  try {
    await setDoc(doc(db, 'users', uid), {
      nickname,
      inviteCode,
      coupleId: null,
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
