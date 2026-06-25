import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

const db = admin.firestore()
const messaging = admin.messaging()

// ─── invite claim (Admin SDK — 양쪽 coupleId + couples 생성) ───────────────

export const claimInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required')
  }

  const code = String(data?.code ?? '').toUpperCase().trim()
  if (!code || code.length < 4) {
    throw new functions.https.HttpsError('not-found', 'invalid_code')
  }

  const myUid = context.auth.uid
  const inviteRef = db.doc(`invites/${code}`)

  return db.runTransaction(async (tx) => {
    const inviteSnap = await tx.get(inviteRef)
    if (!inviteSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'invalid_code')
    }

    const invite = inviteSnap.data()!
    if (invite.claimed) {
      throw new functions.https.HttpsError('failed-precondition', 'already_used')
    }
    if (invite.fromUid === myUid) {
      throw new functions.https.HttpsError('failed-precondition', 'self_connect')
    }

    const partnerUid = invite.fromUid as string
    const members = [myUid, partnerUid].sort()
    const coupleId = members.join('_')

    const myRef = db.doc(`users/${myUid}`)
    const partnerRef = db.doc(`users/${partnerUid}`)
    const coupleRef = db.doc(`couples/${coupleId}`)

    const [mySnap, partnerSnap, coupleSnap] = await Promise.all([
      tx.get(myRef),
      tx.get(partnerRef),
      tx.get(coupleRef),
    ])

    if (!mySnap.exists || !partnerSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'user_missing')
    }
    if (mySnap.data()?.coupleId || partnerSnap.data()?.coupleId) {
      throw new functions.https.HttpsError('failed-precondition', 'already_linked')
    }

    if (!coupleSnap.exists) {
      tx.set(coupleRef, {
        members,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    } else {
      tx.set(coupleRef, {
        isDisconnected: admin.firestore.FieldValue.delete(),
        disconnectedAt: admin.firestore.FieldValue.delete(),
        disconnectedBy: admin.firestore.FieldValue.delete(),
      }, { merge: true })
    }

    tx.update(inviteRef, {
      claimed: true,
      toUid: myUid,
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    tx.update(myRef, { coupleId })
    tx.update(partnerRef, { coupleId })

    return { coupleId, partnerUid }
  })
})

// ─── 커플 연결 해제 (Admin SDK — 양쪽 users.coupleId 해제) ────────────────

export const disconnectCouple = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required')
  }

  const uid = context.auth.uid
  const userRef = db.doc(`users/${uid}`)

  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef)
    if (!userSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'user_missing')
    }

    const coupleId = userSnap.data()?.coupleId as string | undefined
    if (!coupleId) {
      return { ok: true, alreadyDisconnected: true }
    }

    const coupleRef = db.doc(`couples/${coupleId}`)
    const coupleSnap = await tx.get(coupleRef)
    const members = Array.isArray(coupleSnap.data()?.members)
      ? coupleSnap.data()!.members as string[]
      : [uid]

    if (!members.includes(uid)) {
      throw new functions.https.HttpsError('permission-denied', 'not_member')
    }

    for (const memberUid of members) {
      tx.update(db.doc(`users/${memberUid}`), { coupleId: null })
    }

    if (coupleSnap.exists) {
      tx.set(coupleRef, {
        disconnectedAt: admin.firestore.FieldValue.serverTimestamp(),
        disconnectedBy: uid,
        isDisconnected: true,
      }, { merge: true })
    }

    return { ok: true, coupleId, members }
  })
})

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────

async function getPartnerToken(
  coupleId: string,
  senderUid: string,
): Promise<{ tokens: string[]; partnerUid: string } | null> {
  const coupleSnap = await db.doc(`couples/${coupleId}`).get()
  const coupleData = coupleSnap.data() ?? {}
  if (coupleData.isDisconnected === true) {
    console.log('[Push] couple disconnected — skip', { coupleId, senderUid })
    return null
  }

  const members: string[] = coupleData.members ?? []
  const partnerUid = members.find((m) => m !== senderUid)
  if (!partnerUid) {
    console.log('[Push] partner not found in couple members', { coupleId, senderUid, members })
    return null
  }

  const partnerSnap = await db.doc(`users/${partnerUid}`).get()
  const data = partnerSnap.data() ?? {}
  if (data.coupleId !== coupleId) {
    console.log('[Push] partner coupleId mismatch', {
      coupleId,
      senderUid,
      partnerUid,
      partnerCoupleId: data.coupleId ?? null,
    })
    return null
  }

  const tokenMap = data.fcmTokens as Record<string, string> | undefined
  const tokens = new Set<string>()

  if (typeof data.fcmToken === 'string' && data.fcmToken) {
    tokens.add(data.fcmToken)
  }
  if (tokenMap && typeof tokenMap === 'object') {
    Object.values(tokenMap).forEach((token) => {
      if (typeof token === 'string' && token) tokens.add(token)
    })
  }
  if (tokens.size === 0) {
    console.log('[Push] no partner tokens', {
      coupleId,
      senderUid,
      partnerUid,
      fcmUpdatedAt: data.fcmUpdatedAt ?? null,
      deviceCount: tokenMap ? Object.keys(tokenMap).length : 0,
    })
    return null
  }

  console.log('[Push] partner tokens resolved', {
    coupleId,
    senderUid,
    partnerUid,
    tokenCount: tokens.size,
    fcmUpdatedAt: data.fcmUpdatedAt ?? null,
  })

  return { tokens: [...tokens], partnerUid }
}

// 무효 토큰은 다음 발송 실패를 줄이기 위해 best-effort로 정리한다
async function cleanupInvalidTokens(uid: string, tokens: string[]) {
  if (tokens.length === 0) return
  try {
    const snap = await db.doc(`users/${uid}`).get()
    const data = snap.data() ?? {}
    const tokenMap = data.fcmTokens as Record<string, string> | undefined
    const updates: Record<string, unknown> = {}

    if (tokens.includes(data.fcmToken as string)) {
      updates.fcmToken = admin.firestore.FieldValue.delete()
    }

    if (tokenMap && typeof tokenMap === 'object') {
      for (const [deviceId, token] of Object.entries(tokenMap)) {
        if (tokens.includes(token)) {
          updates[`fcmTokens.${deviceId}`] = admin.firestore.FieldValue.delete()
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.doc(`users/${uid}`).update(updates)
    }
  } catch {
    // cleanup 실패는 알림 발송 자체를 막지 않는다
  }
}

// Web/PWA 알림을 파트너의 모든 등록 기기에 발송한다
async function collectUserTokens(uid: string): Promise<string[]> {
  const snap = await db.doc(`users/${uid}`).get()
  const data = snap.data() ?? {}
  const tokenMap = data.fcmTokens as Record<string, string> | undefined
  const tokens = new Set<string>()

  if (typeof data.fcmToken === 'string' && data.fcmToken) {
    tokens.add(data.fcmToken)
  }
  if (tokenMap && typeof tokenMap === 'object') {
    Object.values(tokenMap).forEach((token) => {
      if (typeof token === 'string' && token) tokens.add(token)
    })
  }

  return [...tokens]
}

type PushPayloadType = 'message' | 'status' | 'diary' | 'debug'

type PushSendStats = {
  tokenCount: number
  successCount: number
  failureCount: number
}

async function sendWebPush(
  partnerUid: string,
  tokens: string[],
  payload: {
    type: PushPayloadType
    title: string
    body: string
    data: Record<string, string>
    link: string
  },
): Promise<PushSendStats> {
  if (tokens.length === 0) {
    return { tokenCount: 0, successCount: 0, failureCount: 0 }
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    data: {
      type: payload.type,
      title: payload.title,
      body: payload.body,
      forceSwDisplay: '1',
      notificationId: payload.data.notificationId ?? `${payload.type}-${payload.link}`,
      ...payload.data,
      url: payload.link,
    },
    webpush: {
      headers: { Urgency: 'high' },
      fcmOptions: { link: payload.link },
    },
    android: { priority: 'high' as const },
  })

  console.log('[Push] multicast result', {
    partnerUid,
    type: payload.type,
    tokenCount: tokens.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
  })

  const invalidTokens = response.responses
    .map((result, index) => ({ result, token: tokens[index] }))
    .filter(({ result }) => {
      const code = result.error?.code
      return code === 'messaging/registration-token-not-registered'
        || code === 'messaging/invalid-registration-token'
    })
    .map(({ token }) => token)

  if (response.failureCount > 0) {
    response.responses.forEach((result, index) => {
      if (result.success) return
      console.warn('[Push] token send failed', {
        partnerUid,
        type: payload.type,
        tokenPreview: `${tokens[index]?.slice(0, 12) ?? 'none'}…`,
        code: result.error?.code ?? 'unknown',
        message: result.error?.message ?? '',
      })
    })
  }

  await cleanupInvalidTokens(partnerUid, invalidTokens)

  return {
    tokenCount: tokens.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
  }
}

async function isNotificationEnabled(
  partnerUid: string,
  type: 'message' | 'status' | 'diary',
): Promise<boolean> {
  try {
    const snap = await db.doc(`users/${partnerUid}`).get()
    const settings = snap.data()?.notificationSettings
    if (!settings) return true // 설정 없으면 기본 ON
    return settings[type] !== false
  } catch {
    return true
  }
}

async function getSenderName(uid: string): Promise<string> {
  try {
    const snap = await db.doc(`users/${uid}`).get()
    return snap.data()?.nickname ?? '상대방'
  } catch {
    return '상대방'
  }
}

// ─── 상태 변경 푸시 ────────────────────────────────────────────────────────

export const onStatusUpdate = functions.firestore
  .document('couples/{coupleId}/status/{uid}')
  .onWrite(async (change, context) => {
    const { coupleId, uid } = context.params as { coupleId: string; uid: string }
    if (!change.after.exists) return

    // 첫 상태 등록(create)도 사용자 액션이므로 알림 발송, 무변경 write만 skip
    if (change.before.exists) {
      const before = change.before.data() ?? {}
      const after = change.after.data() ?? {}
      const unchanged =
        before.condition === after.condition
        && before.message === after.message
        && JSON.stringify(before.mood ?? []) === JSON.stringify(after.mood ?? [])
      if (unchanged) return
    }

    const result = await getPartnerToken(coupleId, uid)
    if (!result) return

    const { tokens, partnerUid } = result
    if (!(await isNotificationEnabled(partnerUid, 'status'))) return

    const senderName = await getSenderName(uid)

    await sendWebPush(partnerUid, tokens, {
      type: 'status',
      title: 'Tether 🌿',
      body: `${senderName}이(가) 상태를 업데이트했어요`,
      data: {
        uid,
      },
      link: '/?screen=home',
    })
  })

// ─── 메시지 수신 푸시 ──────────────────────────────────────────────────────

export const onNewMessage = functions.firestore
  .document('couples/{coupleId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { coupleId, messageId } = context.params as { coupleId: string; messageId: string }
    const msg = snap.data()
    if (!msg?.senderUid) return

    const result = await getPartnerToken(coupleId, msg.senderUid as string)
    if (!result) return

    const { tokens, partnerUid } = result
    if (!(await isNotificationEnabled(partnerUid, 'message'))) return

    const senderName = await getSenderName(msg.senderUid as string)
    const body: string =
      msg.type === 'image'
        ? '사진을 보냈어요 📸'
        : msg.type === 'file'
          ? `${(msg.fileName as string | undefined) ?? '파일'}을 보냈어요 📎`
          : (msg.text as string) ?? ''

    await sendWebPush(partnerUid, tokens, {
      type: 'message',
      title: senderName,
      body,
      data: {
        coupleId,
        screen: 'chat',
        notificationId: `message-${coupleId}-${messageId}`,
      },
      link: '/?screen=chat',
    })
  })

// ─── 교환일기 알림 ─────────────────────────────────────────────────────────

export const onNewDiary = functions.firestore
  .document('couples/{coupleId}/diary/{diaryId}')
  .onCreate(async (snap, context) => {
    const { coupleId, diaryId } = context.params as { coupleId: string; diaryId: string }
    const diary = snap.data()
    if (!diary?.authorUid) return

    const result = await getPartnerToken(coupleId, diary.authorUid as string)
    if (!result) return

    const { tokens, partnerUid } = result
    if (!(await isNotificationEnabled(partnerUid, 'diary'))) return

    const senderName = await getSenderName(diary.authorUid as string)

    await sendWebPush(partnerUid, tokens, {
      type: 'diary',
      title: 'Tether 💌',
      body: `${senderName}의 일기가 도착했어요`,
      data: {
        coupleId,
        screen: 'diary',
        notificationId: `diary-${coupleId}-${diaryId}`,
      },
      link: '/?screen=diary',
    })
  })

export const onDiaryReplyCreated = functions.firestore
  .document('couples/{coupleId}/diary/{diaryId}')
  .onUpdate(async (change, context) => {
    const { coupleId, diaryId } = context.params as { coupleId: string; diaryId: string }
    const before = change.before.data()
    const after = change.after.data()
    const beforeReply = before?.reply
    const afterReply = after?.reply

    if (beforeReply || !afterReply?.authorUid) return
    if (!after?.authorUid || after.authorUid === afterReply.authorUid) return

    const result = await getPartnerToken(coupleId, afterReply.authorUid as string)
    if (!result) return

    const { tokens, partnerUid } = result
    if (partnerUid !== after.authorUid) return
    if (!(await isNotificationEnabled(partnerUid, 'diary'))) return

    const senderName = await getSenderName(afterReply.authorUid as string)

    await sendWebPush(partnerUid, tokens, {
      type: 'diary',
      title: 'Tether 💬',
      body: `${senderName}이(가) 일기에 댓글을 남겼어요`,
      data: {
        coupleId,
        screen: 'diary',
        notificationId: `diary-reply-${coupleId}-${diaryId}`,
      },
      link: '/?screen=diary',
    })
  })

// ─── 알림 진단 ping (callable) ─────────────────────────────────────────────

export const debugPushPing = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required')
  }

  const callerUid = context.auth.uid
  const target = data?.target === 'partner' ? 'partner' : 'self'
  let recipientUid = callerUid
  let tokens: string[] = []

  if (target === 'self') {
    tokens = await collectUserTokens(callerUid)
  } else {
    const callerSnap = await db.doc(`users/${callerUid}`).get()
    const coupleId = callerSnap.data()?.coupleId as string | undefined
    if (!coupleId) {
      throw new functions.https.HttpsError('failed-precondition', 'no_couple')
    }

    const result = await getPartnerToken(coupleId, callerUid)
    if (!result) {
      throw new functions.https.HttpsError('failed-precondition', 'no_partner_tokens')
    }
    recipientUid = result.partnerUid
    tokens = result.tokens
  }

  if (tokens.length === 0) {
    console.log('[Push] debugPushPing no tokens', { callerUid, target, recipientUid })
    return {
      ok: false,
      reason: 'no_tokens',
      target,
      recipientUid,
      tokenCount: 0,
      successCount: 0,
      failureCount: 0,
    }
  }

  const stats = await sendWebPush(recipientUid, tokens, {
    type: 'debug',
    title: 'Tether 테스트 알림',
    body: target === 'self'
      ? '이 기기 알림 연결 테스트입니다.'
      : '상대방 기기 알림 연결 테스트입니다.',
    data: {
      screen: 'home',
      debug: '1',
      notificationId: `debug-${target}-${callerUid}`,
    },
    link: '/?screen=home',
  })

  console.log('[Push] debugPushPing result', {
    callerUid,
    target,
    recipientUid,
    ...stats,
  })

  return {
    ok: stats.successCount > 0,
    reason: stats.successCount > 0 ? undefined : 'send_failed',
    target,
    recipientUid,
    ...stats,
  }
})
