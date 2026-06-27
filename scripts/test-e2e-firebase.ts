// scripts/test-e2e-firebase.ts
// Firestore E2E: invite claim 커플 연결 + Codex #16/#17 보안 회귀 시나리오 검증
import { readFileSync } from 'node:fs'
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app'
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  signInWithCustomToken,
  User,
} from 'firebase/auth'
import {
  addDoc,
  arrayUnion,
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
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage'
import {
  initializeApp as initializeAdminApp,
  applicationDefault,
  cert,
  getApps as getAdminApps,
  deleteApp as deleteAdminApp,
  App as AdminApp,
} from 'firebase-admin/app'
import { getAuth as getAdminAuth } from 'firebase-admin/auth'
import {
  FieldValue,
  getFirestore as getAdminFirestore,
} from 'firebase-admin/firestore'

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

function makeUid(label: string) {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getAdmin() {
  const projectId = requireEnv('VITE_FIREBASE_PROJECT_ID')
  const app = getAdminApps()[0] ?? initializeAdminApp({
    projectId,
    credential: getAdminCredential(),
  })
  return {
    app,
    auth: getAdminAuth(app),
    db: getAdminFirestore(app),
  }
}

function getAdminCredential() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS

  try {
    if (rawJson) return cert(JSON.parse(rawJson))
    if (rawBase64) return cert(JSON.parse(Buffer.from(rawBase64, 'base64').toString('utf8')))
    if (path) return cert(JSON.parse(readFileSync(path, 'utf8')))
  } catch (error) {
    throw new Error(`Invalid Firebase Admin credential: ${error instanceof Error ? error.message : String(error)}`)
  }

  throw new Error(
    [
      'Firebase Admin credential is required for live E2E.',
      'Set one of:',
      '- FIREBASE_SERVICE_ACCOUNT_JSON={...service-account-json...}',
      '- FIREBASE_SERVICE_ACCOUNT_BASE64=<base64-json>',
      '- FIREBASE_SERVICE_ACCOUNT_PATH=C:\\path\\service-account.json',
      '- GOOGLE_APPLICATION_CREDENTIALS=C:\\path\\service-account.json',
    ].join('\n'),
  )
}

async function createSeededUser(uid: string, nickname: string) {
  const { auth, db } = getAdmin()
  const email = `${uid}@e2e.tether.local`
  try {
    await auth.createUser({
      uid,
      email,
      emailVerified: true,
      displayName: nickname,
    })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code !== 'auth/uid-already-exists') throw error
  }
  await db.doc(`users/${uid}`).set({
    uid,
    nickname,
    email,
    inviteCode: '',
    coupleId: null,
    role: 'member',
    approved: true,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true })
  await db.doc(`publicProfiles/${uid}`).set({ nickname }, { merge: true })
}

async function signInSeededUser(auth: ReturnType<typeof getAuth>, uid: string): Promise<User> {
  const token = await getAdmin().auth.createCustomToken(uid)
  return (await signInWithCustomToken(auth, token)).user
}

async function cleanupSeededUser(uid: string) {
  const { auth, db } = getAdmin()
  try { await db.doc(`publicProfiles/${uid}`).delete() } catch { /* ignore */ }
  try { await db.doc(`users/${uid}`).delete() } catch { /* ignore */ }
  try { await auth.deleteUser(uid) } catch { /* ignore */ }
}

async function deleteAdminAppIfAny() {
  const app = getAdminApps()[0] as AdminApp | undefined
  if (!app) return
  try { await deleteAdminApp(app) } catch { /* ignore */ }
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

async function expectStorageDenied(label: string, fn: () => Promise<unknown>) {
  try {
    await fn()
    throw new Error(`Security regression failed: ${label} should be denied`)
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code !== 'storage/unauthorized' && code !== 'permission-denied') {
      throw new Error(`Security regression failed: ${label} expected storage denial, got ${code ?? error}`)
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
  let userD: User | null = null
  let appC: FirebaseApp | null = null
  let appD: FirebaseApp | null = null
  let coupleId = ''
  let inviteCode = ''
  const messageIds: string[] = []
  const statusHistoryIds: string[] = []
  const contentIds: string[] = []
  const photoIds: string[] = []
  const feedbackReportIds: string[] = []
  const linkIds: string[] = []
  const dateRecipeIds: string[] = []
  const storagePaths: string[] = []
  const uidA = makeUid('a')
  const uidB = makeUid('b')
  const uidC = makeUid('c')
  const uidD = makeUid('d')

  try {
    await createSeededUser(uidA, 'E2E A')
    await createSeededUser(uidB, 'E2E B')
    userA = await signInSeededUser(authA, uidA)
    userB = await signInSeededUser(authB, uidB)

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
    await createSeededUser(uidC, 'E2E C intruder')
    userC = await signInSeededUser(authC, uidC)

    const appDBundle = makeApp(`e2e-d-${Date.now()}`)
    appD = appDBundle.app
    const authD = appDBundle.auth
    const dbD = appDBundle.db
    userD = await signInSeededUser(authD, uidD)

    await expectDenied('non-google user doc create', () =>
      setDoc(doc(dbD, 'users', userD!.uid), {
        uid: userD!.uid,
        nickname: 'E2E D custom auth',
        inviteCode: '',
        coupleId: null,
        createdAt: serverTimestamp(),
      }),
    )

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

    // ── v0.3.0 feedbackReports 커플 동기화 / ownership ───────────────────
    const feedbackRef = await addDoc(collection(dbA, 'couples', coupleId, 'feedbackReports'), {
      clientId: `e2e-feedback-${Date.now()}`,
      type: 'bug',
      text: 'e2e-feedback-report',
      status: 'open',
      authorUid: userA.uid,
      authorNickname: 'E2E A',
      createdAt: serverTimestamp(),
    })
    feedbackReportIds.push(feedbackRef.id)

    const partnerFeedbackSnap = await getDoc(doc(dbB, 'couples', coupleId, 'feedbackReports', feedbackRef.id))
    if (partnerFeedbackSnap.data()?.text !== 'e2e-feedback-report') {
      throw new Error('Partner feedback report read failed')
    }

    await expectDenied('non-member feedback report read', () =>
      getDoc(doc(dbC, 'couples', coupleId, 'feedbackReports', feedbackRef.id)),
    )

    await expectDenied('non-member feedback report create', () =>
      addDoc(collection(dbC, 'couples', coupleId, 'feedbackReports'), {
        clientId: `e2e-feedback-denied-${Date.now()}`,
        type: 'bug',
        text: 'denied',
        status: 'open',
        authorUid: userC!.uid,
        authorNickname: 'E2E C',
        createdAt: serverTimestamp(),
      }),
    )

    await updateDoc(doc(dbB, 'couples', coupleId, 'feedbackReports', feedbackRef.id), {
      status: 'done',
      updatedAt: serverTimestamp(),
      doneAt: serverTimestamp(),
      doneBy: userB.uid,
    })

    const doneFeedbackSnap = await getDoc(doc(dbA, 'couples', coupleId, 'feedbackReports', feedbackRef.id))
    if (doneFeedbackSnap.data()?.status !== 'done') {
      throw new Error('Partner feedback status update failed')
    }

    await expectDenied('partner feedback text tamper', () =>
      updateDoc(doc(dbB, 'couples', coupleId, 'feedbackReports', feedbackRef.id), {
        text: 'hacked',
      }),
    )

    await expectDenied('feedback authorUid tamper', () =>
      updateDoc(doc(dbA, 'couples', coupleId, 'feedbackReports', feedbackRef.id), {
        authorUid: userB.uid,
      }),
    )

    await expectDenied('partner feedback delete', () =>
      deleteDoc(doc(dbB, 'couples', coupleId, 'feedbackReports', feedbackRef.id)),
    )

    await deleteDoc(doc(dbA, 'couples', coupleId, 'feedbackReports', feedbackRef.id))
    feedbackReportIds.pop()

    // ── v0.4.0 shared library: links / date recipes / link files ──────────
    const linkFilePath = `couples/${coupleId}/links/${userA.uid}/e2e-${Date.now()}.url`
    const linkFileStorageRef = ref(getStorage(appA), linkFilePath)
    await uploadBytes(linkFileStorageRef, new Blob(['[InternetShortcut]\nURL=https://example.com']), {
      contentType: 'text/plain',
    })
    storagePaths.push(linkFilePath)
    const linkFileUrl = await getDownloadURL(linkFileStorageRef)

    const linkRef = await addDoc(collection(dbA, 'couples', coupleId, 'links'), {
      title: 'e2e-link',
      url: 'https://example.com',
      summary: 'e2e shared link',
      fileUrl: linkFileUrl,
      fileName: 'e2e.url',
      createdBy: userA.uid,
      createdAt: serverTimestamp(),
    })
    linkIds.push(linkRef.id)

    const partnerLinkSnap = await getDoc(doc(dbB, 'couples', coupleId, 'links', linkRef.id))
    if (partnerLinkSnap.data()?.title !== 'e2e-link') {
      throw new Error('Partner shared link read failed')
    }

    await expectDenied('non-member shared link read', () =>
      getDoc(doc(dbC, 'couples', coupleId, 'links', linkRef.id)),
    )

    await expectDenied('partner shared link delete', () =>
      deleteDoc(doc(dbB, 'couples', coupleId, 'links', linkRef.id)),
    )

    await expectDenied('shared link createdBy spoof', () =>
      addDoc(collection(dbA, 'couples', coupleId, 'links'), {
        title: 'spoof',
        url: 'https://example.com/spoof',
        summary: null,
        createdBy: userB.uid,
        createdAt: serverTimestamp(),
      }),
    )

    await expectStorageDenied('non-member shared link file upload to member folder', () =>
      uploadBytes(
        ref(getStorage(appC!), `couples/${coupleId}/links/${userA.uid}/e2e-denied-${Date.now()}.url`),
        new Blob(['denied']),
        { contentType: 'text/plain' },
      ),
    )

    const recipeRef = await addDoc(collection(dbA, 'couples', coupleId, 'dateRecipes'), {
      date: '2026-06-25',
      food: 'e2e-food',
      memo: 'e2e date recipe',
      createdBy: userA.uid,
      createdAt: serverTimestamp(),
    })
    dateRecipeIds.push(recipeRef.id)

    const partnerRecipeSnap = await getDoc(doc(dbB, 'couples', coupleId, 'dateRecipes', recipeRef.id))
    if (partnerRecipeSnap.data()?.food !== 'e2e-food') {
      throw new Error('Partner date recipe read failed')
    }

    await expectDenied('non-member date recipe read', () =>
      getDoc(doc(dbC, 'couples', coupleId, 'dateRecipes', recipeRef.id)),
    )

    await expectDenied('partner date recipe delete', () =>
      deleteDoc(doc(dbB, 'couples', coupleId, 'dateRecipes', recipeRef.id)),
    )

    await expectDenied('date recipe createdBy spoof', () =>
      addDoc(collection(dbA, 'couples', coupleId, 'dateRecipes'), {
        date: '2026-06-25',
        food: 'spoof',
        memo: null,
        createdBy: userB.uid,
        createdAt: serverTimestamp(),
      }),
    )

    // ── status / statusHistory 무결성 (#18 Codex Critical) ─────────────────
    await setDoc(doc(dbA, 'couples', coupleId, 'status', userA.uid), {
      uid: userA.uid,
      condition: 'good',
      mood: ['설렘'],
      message: 'e2e-own-status',
      updatedAt: serverTimestamp(),
    })

    const ownStatusSnap = await getDoc(doc(dbA, 'couples', coupleId, 'status', userA.uid))
    if (ownStatusSnap.data()?.message !== 'e2e-own-status') {
      throw new Error('Own status write failed')
    }

    if (userA.uid === userB.uid) {
      throw new Error('E2E setup error: userA and userB must differ')
    }

    await expectDenied('cross-user status overwrite', () =>
      setDoc(doc(dbA, 'couples', coupleId, 'status', userB.uid), {
        uid: userB.uid,
        condition: 'tired',
        mood: [],
        message: 'intrusion',
        updatedAt: serverTimestamp(),
      }),
    )

    const historyRef = await addDoc(collection(dbA, 'couples', coupleId, 'statusHistory'), {
      uid: userA.uid,
      condition: 'good',
      mood: ['평온'],
      message: 'e2e-history',
      createdAt: serverTimestamp(),
    })
    statusHistoryIds.push(historyRef.id)

    await expectDenied('statusHistory uid spoof', () =>
      addDoc(collection(dbA, 'couples', coupleId, 'statusHistory'), {
        uid: userB.uid,
        condition: 'good',
        mood: [],
        message: 'spoof',
        createdAt: serverTimestamp(),
      }),
    )

    await expectDenied('statusHistory update', () =>
      updateDoc(doc(dbA, 'couples', coupleId, 'statusHistory', historyRef.id), {
        message: 'tampered',
      }),
    )

    await expectDenied('statusHistory delete', () =>
      deleteDoc(doc(dbA, 'couples', coupleId, 'statusHistory', historyRef.id)),
    )

    // ── Step 3: users / messages / contents ownership ─────────────────────
    const partnerUserSnap = await getDoc(doc(dbB, 'users', userA.uid))
    if (!partnerUserSnap.exists()) {
      throw new Error('Partner should read coupled user doc')
    }

    await expectDenied('non-partner user doc read', () =>
      getDoc(doc(dbC, 'users', userA.uid)),
    )

    const publicSnap = await getDoc(doc(dbC, 'publicProfiles', userA.uid))
    if (!publicSnap.exists()) {
      throw new Error('Authenticated user should read publicProfiles')
    }

    const profilePhotoPath = `users/${userA.uid}/profile/e2e-${Date.now()}.txt`
    const profilePhotoStorageRef = ref(getStorage(appA), profilePhotoPath)
    await uploadBytes(profilePhotoStorageRef, new Blob(['e2e-profile-photo']), {
      contentType: 'text/plain',
    })
    storagePaths.push(profilePhotoPath)
    const profilePhotoUrl = await getDownloadURL(profilePhotoStorageRef)
    await updateDoc(doc(dbA, 'users', userA.uid), { photoUrl: profilePhotoUrl })
    await setDoc(doc(dbA, 'publicProfiles', userA.uid), { photoUrl: profilePhotoUrl }, { merge: true })

    const partnerProfileSnap = await getDoc(doc(dbB, 'users', userA.uid))
    if (partnerProfileSnap.data()?.photoUrl !== profilePhotoUrl) {
      throw new Error('Partner should read coupled user profile photo URL')
    }
    const publicProfilePhotoSnap = await getDoc(doc(dbC, 'publicProfiles', userA.uid))
    if (publicProfilePhotoSnap.data()?.photoUrl !== profilePhotoUrl) {
      throw new Error('Authenticated user should read public profile photo URL')
    }

    await expectStorageDenied('non-owner profile photo storage upload', () =>
      uploadBytes(
        ref(getStorage(appC!), `users/${userA.uid}/profile/e2e-denied-${Date.now()}.txt`),
        new Blob(['denied']),
        { contentType: 'text/plain' },
      ),
    )

    await expectDenied('self coupleId tamper', () =>
      updateDoc(doc(dbA, 'users', userA.uid), { coupleId: 'fake-couple-id' }),
    )

    await updateDoc(doc(dbA, 'users', userA.uid), {
      'lastRead.contents': serverTimestamp(),
    })

    await updateDoc(doc(dbB, 'couples', coupleId, 'messages', messageRef.id), {
      readBy: arrayUnion(userB.uid),
    })
    const readSnap = await getDoc(doc(dbB, 'couples', coupleId, 'messages', messageRef.id))
    if (!(readSnap.data()?.readBy ?? []).includes(userB.uid)) {
      throw new Error('Partner readBy update failed')
    }

    await expectDenied('partner message text tamper', () =>
      updateDoc(doc(dbB, 'couples', coupleId, 'messages', messageRef.id), {
        text: 'hacked',
      }),
    )

    const chatImagePath = `couples/${coupleId}/images/${userA.uid}/e2e-${Date.now()}.txt`
    const chatImageStorageRef = ref(getStorage(appA), chatImagePath)
    await uploadBytes(chatImageStorageRef, new Blob(['e2e-chat-image']), {
      contentType: 'text/plain',
    })
    storagePaths.push(chatImagePath)
    await getDownloadURL(chatImageStorageRef)

    await expectStorageDenied('non-member chat image storage upload to member folder', () =>
      uploadBytes(
        ref(getStorage(appC!), `couples/${coupleId}/images/${userA.uid}/e2e-denied-${Date.now()}.txt`),
        new Blob(['denied']),
        { contentType: 'text/plain' },
      ),
    )

    const contentRef = await addDoc(collection(dbA, 'couples', coupleId, 'contents'), {
      addedBy: userA.uid,
      category: 'movie',
      title: 'e2e-content',
      memo: null,
      status: 'want',
      rating: null,
      review: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    contentIds.push(contentRef.id)

    await expectDenied('partner content delete', () =>
      deleteDoc(doc(dbB, 'couples', coupleId, 'contents', contentRef.id)),
    )

    await deleteDoc(doc(dbA, 'couples', coupleId, 'contents', contentRef.id))

    const photoPath = `couples/${coupleId}/photos/${userA.uid}/e2e-${Date.now()}.txt`
    const photoStorageRef = ref(getStorage(appA), photoPath)
    await uploadBytes(photoStorageRef, new Blob(['e2e-photo']), {
      contentType: 'text/plain',
    })
    storagePaths.push(photoPath)
    const photoUrl = await getDownloadURL(photoStorageRef)
    const photoRef = await addDoc(collection(dbA, 'couples', coupleId, 'photos'), {
      clientId: `e2e-photo-${Date.now()}`,
      uploadedBy: userA.uid,
      imageUrl: photoUrl,
      caption: 'e2e-photo',
      createdAt: serverTimestamp(),
    })
    photoIds.push(photoRef.id)

    const partnerPhotoSnap = await getDoc(doc(dbB, 'couples', coupleId, 'photos', photoRef.id))
    if (partnerPhotoSnap.data()?.imageUrl !== photoUrl) {
      throw new Error('Partner photo album display read failed')
    }

    await expectDenied('partner photo caption overwrite', () =>
      updateDoc(doc(dbB, 'couples', coupleId, 'photos', photoRef.id), {
        caption: 'hacked',
      }),
    )

    await expectStorageDenied('non-member photo storage upload to member folder', () =>
      uploadBytes(
        ref(getStorage(appC!), `couples/${coupleId}/photos/${userA.uid}/e2e-denied-${Date.now()}.txt`),
        new Blob(['denied']),
        { contentType: 'text/plain' },
      ),
    )

    await expectDenied('non-member photo document create', () =>
      addDoc(collection(dbC, 'couples', coupleId, 'photos'), {
        uploadedBy: userC!.uid,
        imageUrl: 'https://example.com/denied.jpg',
        caption: 'denied',
        createdAt: serverTimestamp(),
      }),
    )

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
      'Firebase E2E passed: invite claim, bidirectional share, status integrity, Step 3 ownership rules, security regression',
    )
  } finally {
    if (coupleId) {
      try {
        const adminDb = getAdmin().db
        for (const id of messageIds) {
          await adminDb.doc(`couples/${coupleId}/messages/${id}`).delete()
        }
        for (const id of statusHistoryIds) {
          await adminDb.doc(`couples/${coupleId}/statusHistory/${id}`).delete()
        }
        for (const id of contentIds) {
          await adminDb.doc(`couples/${coupleId}/contents/${id}`).delete()
        }
        for (const id of photoIds) {
          await adminDb.doc(`couples/${coupleId}/photos/${id}`).delete()
        }
        for (const id of feedbackReportIds) {
          await adminDb.doc(`couples/${coupleId}/feedbackReports/${id}`).delete()
        }
        for (const id of linkIds) {
          await adminDb.doc(`couples/${coupleId}/links/${id}`).delete()
        }
        for (const id of dateRecipeIds) {
          await adminDb.doc(`couples/${coupleId}/dateRecipes/${id}`).delete()
        }
        for (const path of storagePaths) {
          await deleteObject(ref(getStorage(appA), path))
        }
        if (userA) await adminDb.doc(`couples/${coupleId}/status/${userA.uid}`).delete()
        if (userB) await adminDb.doc(`couples/${coupleId}/status/${userB.uid}`).delete()
        await adminDb.doc(`couples/${coupleId}`).delete()
      } catch { /* ignore */ }
    }

    if (inviteCode) {
      try { await getAdmin().db.doc(`invites/${inviteCode}`).delete() } catch { /* ignore */ }
    }

    if (userD) await cleanupSeededUser(userD.uid)
    if (userC) await cleanupSeededUser(userC.uid)
    if (userA) await cleanupSeededUser(userA.uid)
    if (userB) await cleanupSeededUser(userB.uid)

    if (appC) {
      try { await deleteApp(appC) } catch { /* ignore */ }
    }
    if (appD) {
      try { await deleteApp(appD) } catch { /* ignore */ }
    }
    await Promise.all([deleteApp(appA), deleteApp(appB)])
    await deleteAdminAppIfAny()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
