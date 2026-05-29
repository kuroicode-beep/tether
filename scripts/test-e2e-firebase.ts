// scripts/test-e2e-firebase.ts
// Firestore E2E: 정상 커플 연결/공유 + Codex 지적 보안 회귀 시나리오 검증
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
    // best-effort
  }
}

// permission-denied 여부를 확인하는 헬퍼
async function expectDenied(label: string, fn: () => Promise<unknown>) {
  try {
    await fn()
    throw new Error(`Security regression failed: ${label} should be denied`)
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code !== 'permission-denied') {
      throw new Error(`Security regression failed: ${label} expected permission-denied, got ${code ?? error}`)
    }
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
  let userC: User | null = null
  let appC: FirebaseApp | null = null
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

    const inviteSnap = await getDocs(query(collection(dbB, 'users'), where('inviteCode', '==', codeA)))
    if (inviteSnap.empty) throw new Error('Authenticated invite lookup failed')

    coupleId = [userA.uid, userB.uid].sort().join('_')
    await runTransaction(dbB, async (tx) => {
      const coupleRef = doc(dbB, 'couples', coupleId)
      const myRef = doc(dbB, 'users', userB!.uid)
      const partnerRef = doc(dbB, 'users', userA!.uid)
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
      }
      tx.update(myRef, { coupleId })
      tx.update(partnerRef, { coupleId })
    })

    const restoredA = await getDoc(doc(dbA, 'users', userA.uid))
    const restoredB = await getDoc(doc(dbB, 'users', userB.uid))
    if (restoredA.data()?.coupleId !== coupleId || restoredB.data()?.coupleId !== coupleId) {
      throw new Error('coupleId restore failed')
    }

    const coupleFromA = await getDoc(doc(dbA, 'couples', coupleId))
    const coupleFromB = await getDoc(doc(dbB, 'couples', coupleId))
    if (!coupleFromA.exists() || !coupleFromB.exists()) {
      throw new Error('couples doc not readable from both members')
    }

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

    await updateDoc(doc(dbB, 'couples', coupleId), {
      anniversaries: [{
        id: 'e2e-first-met',
        type: 'first_met',
        label: '처음 만난 날',
        date: '2026-05-29',
        isYearly: false,
      }],
    })

    const coupleSnap = await getDoc(doc(dbA, 'couples', coupleId))
    if (coupleSnap.data()?.anniversaries?.[0]?.id !== 'e2e-first-met') {
      throw new Error('Couple document shared update failed')
    }

    // ── Codex 보안 회귀: 악성 사용자 C ─────────────────────────────────────
    appC = makeApp(`e2e-c-${Date.now()}`)
    const authC = getAuth(appC)
    const dbC = getFirestore(appC)
    userC = (await signInAnonymously(authC)).user

    await setDoc(doc(dbC, 'users', userC.uid), {
      uid: userC.uid,
      nickname: 'E2E C intruder',
      inviteCode: `E2EC${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
      coupleId: null,
      createdAt: serverTimestamp(),
    })

    // Critical #1: 비멤버가 기존 couples.members에 자신을 추가할 수 없어야 함
    await expectDenied('non-member couples members update', () =>
      updateDoc(doc(dbC, 'couples', coupleId), {
        members: [userA.uid, userB.uid, userC!.uid],
        intrudedBy: userC!.uid,
      }),
    )

    // Critical #1b: 비멤버가 couples 하위 messages에 write할 수 없어야 함
    await expectDenied('non-member subcollection write', () =>
      addDoc(collection(dbC, 'couples', coupleId, 'messages'), {
        senderUid: userC!.uid,
        type: 'text',
        text: 'intrusion',
        createdAt: serverTimestamp(),
        readBy: [userC!.uid],
      }),
    )

    // Critical #2: 임의 사용자 C가 A의 coupleId를 오염시킬 수 없어야 함
    await expectDenied('arbitrary user coupleId cross-update', () =>
      updateDoc(doc(dbC, 'users', userA.uid), { coupleId }),
    )

    // 존재하지 않는 coupleId로 cross-update도 거부되어야 함
    await expectDenied('nonexistent coupleId cross-update', () =>
      updateDoc(doc(dbC, 'users', userA.uid), { coupleId: 'fake_uid1_fake_uid2' }),
    )

    console.log('Firebase E2E passed: linking, bidirectional share, anniversaries, security regression (2 Critical scenarios blocked)')
  } finally {
    if (userA && userB && coupleId) {
      try {
        for (const id of messageIds) {
          await deleteDoc(doc(dbA, 'couples', coupleId, 'messages', id))
        }
        await updateDoc(doc(dbA, 'couples', coupleId), { anniversaries: [] })
      } catch { /* ignore */ }
    }

    if (userC && appC) {
      const dbC = getFirestore(appC)
      try { await deleteDoc(doc(dbC, 'users', userC.uid)) } catch { /* ignore */ }
      await deleteAuthUser(userC)
      try { await deleteApp(appC) } catch { /* ignore */ }
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
