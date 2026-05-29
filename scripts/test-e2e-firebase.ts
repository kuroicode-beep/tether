import { readFileSync } from 'node:fs'
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app'
import {
  getAuth,
  signInAnonymously,
  deleteUser,
  User,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

function loadEnv() {
  const env = readFileSync('.env', 'utf8')
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index)
    const value = trimmed.slice(index + 1)
    process.env[key] = process.env[key] ?? value
  }
}

function requireEnv(key: string) {
  const value = process.env[key]
  if (!value) throw new Error(`Missing ${key}`)
  return value
}

function makeApp(name: string): FirebaseApp {
  return initializeApp({
    apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
    authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: requireEnv('VITE_FIREBASE_APP_ID'),
  }, name)
}

async function deleteAuthUser(user: User) {
  try {
    await deleteUser(user)
  } catch {
    // Auth cleanup is best-effort because recently-created anonymous users can
    // still be purged by Firebase automatically if client deletion is denied.
  }
}

async function main() {
  loadEnv()

  const appA = makeApp(`e2e-a-${Date.now()}`)
  const appB = makeApp(`e2e-b-${Date.now()}`)
  const authA = getAuth(appA)
  const authB = getAuth(appB)
  const dbA = getFirestore(appA)
  const dbB = getFirestore(appB)

  let userA: User | null = null
  let userB: User | null = null
  let coupleId = ''
  let messageId = ''

  try {
    userA = (await signInAnonymously(authA)).user
    userB = (await signInAnonymously(authB)).user

    const codeA = `E2EA${Math.random().toString(36).slice(2, 4).toUpperCase()}`
    const codeB = `E2EB${Math.random().toString(36).slice(2, 4).toUpperCase()}`

    await setDoc(doc(dbA, 'users', userA.uid), {
      uid: userA.uid,
      nickname: 'E2E A',
      inviteCode: codeA,
      coupleId: null,
      createdAt: serverTimestamp(),
    })
    await setDoc(doc(dbB, 'users', userB.uid), {
      uid: userB.uid,
      nickname: 'E2E B',
      inviteCode: codeB,
      coupleId: null,
      createdAt: serverTimestamp(),
    })

    const inviteSnap = await getDocs(query(collection(dbB, 'users'), where('inviteCode', '==', codeA)))
    if (inviteSnap.empty) throw new Error('Authenticated invite lookup failed')

    coupleId = [userA.uid, userB.uid].sort().join('_')
    await setDoc(doc(dbA, 'couples', coupleId), {
      members: [userA.uid, userB.uid],
      anniversaries: [],
      createdAt: serverTimestamp(),
    })
    await updateDoc(doc(dbA, 'users', userA.uid), { coupleId })
    await updateDoc(doc(dbA, 'users', userB.uid), { coupleId })

    const restoredA = await getDoc(doc(dbA, 'users', userA.uid))
    const restoredB = await getDoc(doc(dbB, 'users', userB.uid))
    if (restoredA.data()?.coupleId !== coupleId || restoredB.data()?.coupleId !== coupleId) {
      throw new Error('coupleId restore failed')
    }

    const messageRef = await addDoc(collection(dbA, 'couples', coupleId, 'messages'), {
      senderUid: userA.uid,
      type: 'text',
      text: 'firebase-e2e',
      createdAt: serverTimestamp(),
      readBy: [userA.uid],
    })
    messageId = messageRef.id

    const messageSnap = await getDoc(doc(dbB, 'couples', coupleId, 'messages', messageId))
    if (messageSnap.data()?.text !== 'firebase-e2e') {
      throw new Error('Partner shared data read failed')
    }

    await setDoc(doc(dbB, 'couples', coupleId), {
      anniversaries: [{
        id: 'e2e-first-met',
        type: 'first_met',
        label: '처음 만난 날',
        date: '2026-05-29',
        isYearly: false,
      }],
    }, { merge: true })

    const coupleSnap = await getDoc(doc(dbA, 'couples', coupleId))
    if (coupleSnap.data()?.anniversaries?.[0]?.id !== 'e2e-first-met') {
      throw new Error('Couple document shared update failed')
    }

    console.log('Firebase E2E passed: invite lookup, couple linking, shared messages, anniversaries')
  } finally {
    if (userA && userB && coupleId) {
      try {
        if (messageId) {
          await deleteDoc(doc(dbA, 'couples', coupleId, 'messages', messageId))
        }
        await deleteDoc(doc(dbA, 'couples', coupleId))
      } catch { /* ignore */ }
    }

    if (userA) {
      try { await deleteDoc(doc(dbA, 'users', userA.uid)) } catch { /* ignore */ }
      await deleteAuthUser(userA)
    }
    if (userB) {
      try { await deleteDoc(doc(dbB, 'users', userB.uid)) } catch { /* ignore */ }
      await deleteAuthUser(userB)
    }

    await Promise.all([deleteApp(appA), deleteApp(appB)])
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
