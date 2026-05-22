import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

const db = admin.firestore()
const messaging = admin.messaging()

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────

async function getPartnerToken(
  coupleId: string,
  senderUid: string,
): Promise<{ token: string; partnerUid: string } | null> {
  const coupleSnap = await db.doc(`couples/${coupleId}`).get()
  const members: string[] = coupleSnap.data()?.members ?? []
  const partnerUid = members.find((m) => m !== senderUid)
  if (!partnerUid) return null

  const partnerSnap = await db.doc(`users/${partnerUid}`).get()
  const token: string | undefined = partnerSnap.data()?.fcmToken
  if (!token) return null

  // 알림 설정 확인
  return { token, partnerUid }
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

    const result = await getPartnerToken(coupleId, uid)
    if (!result) return

    const { token, partnerUid } = result
    if (!(await isNotificationEnabled(partnerUid, 'status'))) return

    const senderName = await getSenderName(uid)

    await messaging.send({
      token,
      notification: {
        title: 'Tether 🌿',
        body: `${senderName}이(가) 상태를 업데이트했어요`,
      },
      data: { type: 'status', uid },
      webpush: {
        notification: { icon: '/icon-192.png', badge: '/icon-192.png' },
      },
    })
  })

// ─── 메시지 수신 푸시 ──────────────────────────────────────────────────────

export const onNewMessage = functions.firestore
  .document('couples/{coupleId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { coupleId } = context.params as { coupleId: string }
    const msg = snap.data()
    if (!msg?.senderUid) return

    const result = await getPartnerToken(coupleId, msg.senderUid as string)
    if (!result) return

    const { token, partnerUid } = result
    if (!(await isNotificationEnabled(partnerUid, 'message'))) return

    const senderName = await getSenderName(msg.senderUid as string)
    const body: string = msg.type === 'image' ? '사진을 보냈어요 📸' : (msg.text as string) ?? ''

    await messaging.send({
      token,
      notification: { title: senderName, body },
      data: { type: 'message', coupleId },
      webpush: {
        notification: { icon: '/icon-192.png', badge: '/icon-192.png' },
      },
    })
  })

// ─── 교환일기 알림 ─────────────────────────────────────────────────────────

export const onNewDiary = functions.firestore
  .document('couples/{coupleId}/diary/{diaryId}')
  .onCreate(async (snap, context) => {
    const { coupleId } = context.params as { coupleId: string }
    const diary = snap.data()
    if (!diary?.authorUid) return

    const result = await getPartnerToken(coupleId, diary.authorUid as string)
    if (!result) return

    const { token, partnerUid } = result
    if (!(await isNotificationEnabled(partnerUid, 'diary'))) return

    const senderName = await getSenderName(diary.authorUid as string)

    await messaging.send({
      token,
      notification: {
        title: 'Tether 💌',
        body: `${senderName}의 일기가 도착했어요`,
      },
      data: { type: 'diary', coupleId },
      webpush: {
        notification: { icon: '/icon-192.png', badge: '/icon-192.png' },
      },
    })
  })
