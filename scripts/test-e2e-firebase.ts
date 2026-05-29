// scripts/test-e2e-firebase.ts
// Firestore E2E: invite claim 커플 연결 + Codex #16/#17 보안 회귀 시나리오 검증
import { readFileSync } from 'node:fs'
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app'
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
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
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'

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

function makeApp(name: string) {
  const app = initializeApp({
    apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
    authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: requireEnv('VITE_FIREBASE_APP_ID'),
  }, name)
  const auth = initializeAuth(app, { persistence: inMemoryPersistence })
  return { app, auth, db: getFirestore(app) }
}

async function deleteAuthUser(user: User) {
  try {
    await deleteUser(user)
  } catch {
    // best-effort
  }
}

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

async function expectCallableError(label: string, fn: () => Promise<unknown>, expected: string) {
  try {
    await fn()
    throw new Error(`Expected ${label} to fail with ${expected}`)
  } catch (error) {
    const message = String((error as { message?: string }).message ?? error)
    if (!message.includes(expected)) {
      throw new Error(`${label} expected ${expected}, got ${message}`)
    }
  }
}

// invites/{code} 1회용 토큰 생성
async function createInvite(db: ReturnType<typeof getFirestore>, uid: string): Promise<string> {
  const code = `E2E${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  await setDoc(doc(db, 'invites', code), {
    fromUid: uid,
    code,
    createdAt: serverTimestamp(),
    claimed: false,
  })
  await updateDoc(doc(db, 'users', uid), { inviteCode: code })
  return code
}

// Cloud Function claimInvite 호출
async function claimInvite(app: FirebaseApp, auth: ReturnType<typeof getAuth>, code: string) {
  if (!auth.currentUser) throw new Error('Auth user missing before claimInvite')
  await auth.currentUser.getIdToken(true)

  const fn = httpsCallable<{ code: string }, { coupleId: string; partnerUid: string }>(
    getFunctions(app, 'us-central1'),
    'claimInvite',
  )
  const { data } = await fn({ code })
  return data
}

async function main() {
  loadEnv()

  const { app: appA, auth: authA, db: dbA } = makeApp(`e2e-a-${Date.now()}`)
  const { app: appB, auth: authB, db: dbB } = makeApp(`e2e-b-${Date.now()}`)

  let userA: User | null = null
  let userB: User | null = null
  let userC: User | null = null
  let appC: FirebaseApp | null = null
  let coupleId = ''
  let inviteCode = ''
  const messageIds: string[] = []

  try {
    userA = (await signInAnonymously(authA)).user
    userB = (await signInAnonymously(authB)).user

    await setDoc(doc(dbA, 'users', userA.uid), {
      uid: userA.uid,
      nickname: 'E2E A',
      inviteCode: '',
      coupleId: null,
      createdAt: serverTimestamp(),
    })
    await setDoc(doc(dbB, 'users', userB.uid), {
      uid: userB.uid,
      nickname: 'E2E B',
      inviteCode: '',
      coupleId: null,
      createdAt: serverTimestamp(),
    })

    // ── 정상 invite claim 커플 연결 ─────────────────────────────────────────
    inviteCode = await createInvite(dbA, userA.uid)
    const claimResult = await claimInvite(appB, authB, inviteCode)
    coupleId = claimResult.coupleId

    if (claimResult.partnerUid !== userA.uid) {
      throw new Error('claimInvite returned wrong partnerUid')
    }

    const restoredA = await getDoc(doc(dbA, 'users', userA.uid))
    const restoredB = await getDoc(doc(dbB, 'users', userB.uid))
    if (restoredA.data()?.coupleId !== coupleId || restoredB.data()?.coupleId !== coupleId) {
      throw new Error('coupleId restore failed after invite claim')
    }

    const inviteSnap = await getDoc(doc(dbA, 'invites', inviteCode))
    if (!inviteSnap.data()?.claimed || inviteSnap.data()?.toUid !== userB.uid) {
      throw new Error('invite was not marked claimed')
    }

    const coupleFromA = await getDoc(doc(dbA, 'couples', coupleId))
    const coupleFromB = await getDoc(doc(dbB, 'couples', coupleId))
    if (!coupleFromA.exists() || !coupleFromB.exists()) {
      throw new Error('couples doc not readable from both members')
    }

    // ── 이미 claim된 코드 재사용 차단 ─────────────────────────────────────
    const appCBundle = makeApp(`e2e-c-${Date.now()}`)
    appC = appCBundle.app
    const authC = appCBundle.auth
    const dbC = appCBundle.db
    userC = (await signInAnonymously(authC)).user

    await setDoc(doc(dbC, 'users', userC.uid), {
      uid: userC.uid,
      nickname: 'E2E C intruder',
      inviteCode: '',
      coupleId: null,
      createdAt: serverTimestamp(),
    })

    await expectCallableError(
      'already used invite code',
      () => claimInvite(appC, authC, inviteCode),
      'already_used',
    )

    // ── 양방향 데이터 공유 ───────────────────────────────────────────────
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

    // ── Codex #16/#17 보안 회귀 ───────────────────────────────────────────
    await expectDenied('forced user coupleId cross-update', () =>
      updateDoc(doc(dbC, 'users', userA.uid), { coupleId }),
    )

    await expectDenied('forced couple doc create', () =>
      setDoc(doc(dbC, 'couples', [userC!.uid, userA.uid].sort().join('_')), {
        members: [userA.uid, userC!.uid].sort(),
        createdAt: serverTimestamp(),
      }),
    )

    await expectDenied('non-member couples members update', () =>
      updateDoc(doc(dbC, 'couples', coupleId), {
        members: [userA.uid, userB.uid, userC!.uid],
        intrudedBy: userC!.uid,
      }),
    )

    await expectDenied('non-member subcollection write', () =>
      addDoc(collection(dbC, 'couples', coupleId, 'messages'), {
        senderUid: userC!.uid,
        type: 'text',
        text: 'intrusion',
        createdAt: serverTimestamp(),
        readBy: [userC!.uid],
      }),
    )

    console.log(
      'Firebase E2E passed: invite claim, bidirectional share, anniversaries, security regression (forced pairing blocked)',
    )
  } finally {
    if (userA && userB && coupleId) {
      try {
        for (const id of messageIds) {
          await deleteDoc(doc(dbA, 'couples', coupleId, 'messages', id))
        }
        await updateDoc(doc(dbA, 'couples', coupleId), { anniversaries: [] })
        await deleteDoc(doc(dbA, 'couples', coupleId))
      } catch { /* ignore */ }
    }

    if (inviteCode) {
      try { await deleteDoc(doc(dbA, 'invites', inviteCode)) } catch { /* ignore */ }
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
