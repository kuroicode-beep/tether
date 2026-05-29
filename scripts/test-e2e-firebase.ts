// scripts/test-e2e-firebase.ts
// 실제 Firestore에 두 사용자를 만들어 connectCouple 트랜잭션과 양방향 데이터 공유를 검증한다
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
  runTransaction,
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
    // best-effort: 익명 사용자 자동 폐기에 의존
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
  const messageIds: string[] = []

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

    // ① 초대 코드 검색
    const inviteSnap = await getDocs(query(collection(dbB, 'users'), where('inviteCode', '==', codeA)))
    if (inviteSnap.empty) throw new Error('Authenticated invite lookup failed')

    // ② 트랜잭션으로 커플 연결 (코드 입력자 B 컨텍스트)
    coupleId = [userA.uid, userB.uid].sort().join('_')
    await runTransaction(dbB, async (tx) => {
      const coupleRef = doc(dbB, 'couples', coupleId)
      const myRef = doc(dbB, 'users', userB!.uid)
      const partnerRef = doc(dbB, 'users', userA!.uid)
      // 모든 read를 write보다 먼저 수행
      const coupleSnap = await tx.get(coupleRef)
      const mySnap = await tx.get(myRef)
      const partnerSnap = await tx.get(partnerRef)
      if (!mySnap.exists() || !partnerSnap.exists()) {
        throw new Error('user docs missing in transaction')
      }
      if (!coupleSnap.exists()) {
        tx.set(coupleRef, {
          members: [userA!.uid, userB!.uid].sort(),
          createdAt: serverTimestamp(),
        })
      } else {
        tx.update(coupleRef, { members: [userA!.uid, userB!.uid].sort() })
      }
      tx.update(myRef, { coupleId })
      tx.update(partnerRef, { coupleId })
    })

    // ③ 양쪽 사용자 모두에서 coupleId가 보이는지 확인
    const restoredA = await getDoc(doc(dbA, 'users', userA.uid))
    const restoredB = await getDoc(doc(dbB, 'users', userB.uid))
    if (restoredA.data()?.coupleId !== coupleId || restoredB.data()?.coupleId !== coupleId) {
      throw new Error('coupleId restore failed')
    }

    // ④ 양쪽 사용자 모두에서 couples 문서를 읽을 수 있는지 확인
    const coupleFromA = await getDoc(doc(dbA, 'couples', coupleId))
    const coupleFromB = await getDoc(doc(dbB, 'couples', coupleId))
    if (!coupleFromA.exists() || !coupleFromB.exists()) {
      throw new Error('couples doc not readable from both members')
    }

    // ⑤ A → B 메시지 전송
    const messageRef = await addDoc(collection(dbA, 'couples', coupleId, 'messages'), {
      senderUid: userA.uid,
      type: 'text',
      text: 'firebase-e2e',
      createdAt: serverTimestamp(),
      readBy: [userA.uid],
    })
    messageIds.push(messageRef.id)

    const messageSnap = await getDoc(doc(dbB, 'couples', coupleId, 'messages', messageRef.id))
    if (messageSnap.data()?.text !== 'firebase-e2e') {
      throw new Error('Partner shared data read failed: A to B')
    }

    // ⑥ B → A 답장 전송
    const replyRef = await addDoc(collection(dbB, 'couples', coupleId, 'messages'), {
      senderUid: userB.uid,
      type: 'text',
      text: 'firebase-e2e-reply',
      createdAt: serverTimestamp(),
      readBy: [userB.uid],
    })
    messageIds.push(replyRef.id)

    const replySnap = await getDoc(doc(dbA, 'couples', coupleId, 'messages', replyRef.id))
    if (replySnap.data()?.text !== 'firebase-e2e-reply') {
      throw new Error('Partner shared data read failed: B to A')
    }

    // ⑦ 기념일 공유
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

    console.log('Firebase E2E passed: invite lookup, transactional couple linking, bidirectional messages, anniversaries, couple doc readable from both members')
  } finally {
    if (userA && userB && coupleId) {
      try {
        for (const id of messageIds) {
          await deleteDoc(doc(dbA, 'couples', coupleId, 'messages', id))
        }
        await updateDoc(doc(dbA, 'couples', coupleId), { anniversaries: [] })
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
