// src/screens/AdminScreen.tsx
// kuroicode@gmail.com 전용 관리자 화면.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  collection,
  collectionGroup,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { ADMIN_EMAIL, isAdminEmail } from '../lib/coupleAuth'
import { useSession } from '../context/useSession'
import { SubScreen } from '../components/SubScreen'
import { ScreenHeader } from '../components/ScreenHeader'
import { DEFAULT_STATUS_TAGS } from '../hooks/useStatusOptions'
import { useMaintenanceControl, useMaintenanceMode } from '../hooks/useMaintenanceMode'

interface AdminScreenProps {
  onBack: () => void
}

type AdminUser = {
  id: string
  email: string
  nickname: string
  approved: boolean
  coupleId: string | null
  tokenCount: number
  hasLegacyToken: boolean
}

type AdminLog = {
  id: string
  type: string
  text: string
  authorNickname: string
  status: string
}

function readTokenCount(data: Record<string, unknown>): number {
  const tokens = data.fcmTokens
  if (tokens && typeof tokens === 'object' && !Array.isArray(tokens)) {
    return Object.keys(tokens).length
  }
  return 0
}

function toStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function AdminScreen({ onBack }: AdminScreenProps) {
  const { user } = useSession()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [tags, setTags] = useState<string[]>(DEFAULT_STATUS_TAGS)
  const [tagInput, setTagInput] = useState('')
  const [error, setError] = useState('')
  const canAdmin = isAdminEmail(user?.email)
  const maintenance = useMaintenanceMode()
  const maintenanceControl = useMaintenanceControl()
  const [noticeInput, setNoticeInput] = useState('')
  const noticeTouchedRef = useRef(false)

  // 서버에서 읽어온 공지 문구를 한 번만 입력창에 채운다 (편집 중이면 덮어쓰지 않는다)
  useEffect(() => {
    if (maintenance.loading || noticeTouchedRef.current) return
    noticeTouchedRef.current = true
    setNoticeInput(maintenance.message)
  }, [maintenance.loading, maintenance.message])

  useEffect(() => {
    if (!canAdmin) return
    const unsub = onSnapshot(
      query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100)),
      (snap) => {
        setUsers(snap.docs.map((item) => {
          const data = item.data() as Record<string, unknown>
          return {
            id: item.id,
            email: typeof data.email === 'string' ? data.email : '',
            nickname: typeof data.nickname === 'string' ? data.nickname : '나',
            approved: data.approved !== false,
            coupleId: typeof data.coupleId === 'string' ? data.coupleId : null,
            tokenCount: readTokenCount(data),
            hasLegacyToken: typeof data.fcmToken === 'string' && data.fcmToken.length > 0,
          }
        }))
      },
      (err) => {
        console.warn('[AdminScreen] users listener failed', err)
        setError('회원 정보를 불러오지 못했어요.')
      },
    )
    return () => unsub()
  }, [canAdmin])

  useEffect(() => {
    if (!canAdmin) return
    const unsub = onSnapshot(
      doc(db, 'adminConfig', 'statusOptions'),
      (snap) => {
        const data = snap.data() ?? {}
        setTags(toStringList(data.extraTags, DEFAULT_STATUS_TAGS))
      },
      (err) => {
        console.warn('[AdminScreen] config listener failed', err)
        setError('관리자 설정을 불러오지 못했어요.')
      },
    )
    return () => unsub()
  }, [canAdmin])

  useEffect(() => {
    if (!canAdmin) return
    const unsub = onSnapshot(
      query(collectionGroup(db, 'feedbackReports'), orderBy('createdAt', 'desc'), limit(20)),
      (snap) => {
        setLogs(snap.docs.map((item) => {
          const data = item.data() as Record<string, unknown>
          return {
            id: item.id,
            type: typeof data.type === 'string' ? data.type : 'log',
            text: typeof data.text === 'string' ? data.text : '',
            authorNickname: typeof data.authorNickname === 'string' ? data.authorNickname : '익명',
            status: typeof data.status === 'string' ? data.status : 'open',
          }
        }))
      },
      (err) => {
        console.warn('[AdminScreen] logs listener failed', err)
      },
    )
    return () => unsub()
  }, [canAdmin])

  const pendingCount = users.filter((item) => !item.approved).length
  const totalTokenCount = useMemo(
    () => users.reduce((sum, item) => sum + item.tokenCount + (item.hasLegacyToken ? 1 : 0), 0),
    [users],
  )

  const saveOptions = async (nextTags: string[]) => {
    await setDoc(doc(db, 'adminConfig', 'statusOptions'), {
      extraTags: nextTags,
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid ?? null,
    }, { merge: true })
  }

  const approveUser = async (uid: string) => {
    await updateDoc(doc(db, 'users', uid), {
      approved: true,
      approvedAt: serverTimestamp(),
      approvedBy: user?.uid ?? null,
    })
  }

  const addTag = async () => {
    const next = tagInput.trim()
    if (!next || tags.includes(next)) return
    const nextTags = [...tags, next]
    setTags(nextTags)
    setTagInput('')
    await saveOptions(nextTags)
  }

  const removeTag = async (tag: string) => {
    const nextTags = tags.filter((item) => item !== tag)
    setTags(nextTags)
    await saveOptions(nextTags)
  }

  if (!canAdmin) {
    return (
      <SubScreen>
        <ScreenHeader title="Admin" onBack={onBack} />
        <main className="sub-screen-body px-margin-mobile py-xl">
          <p className="hc-readable-box rounded-xl bg-surface p-lg text-center font-body-md text-body-md text-on-surface">
            관리자 전용 화면입니다. {ADMIN_EMAIL} 계정으로 로그인해주세요.
          </p>
        </main>
      </SubScreen>
    )
  }

  return (
    <SubScreen>
      <ScreenHeader title="Admin" onBack={onBack} />
      <main className="sub-screen-body space-y-lg px-margin-mobile py-lg pb-32">
        {error && (
          <p className="hc-readable-box rounded-xl bg-error-container p-md font-label-sm text-label-sm text-error">
            {error}
          </p>
        )}

        <section className="grid grid-cols-3 gap-sm">
          <div className="hc-readable-box rounded-xl bg-surface p-md text-center">
            <p className="font-headline-sm text-headline-sm text-primary">{users.length}</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">회원</p>
          </div>
          <div className="hc-readable-box rounded-xl bg-surface p-md text-center">
            <p className="font-headline-sm text-headline-sm text-primary">{pendingCount}</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">승인 대기</p>
          </div>
          <div className="hc-readable-box rounded-xl bg-surface p-md text-center">
            <p className="font-headline-sm text-headline-sm text-primary">{totalTokenCount}</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">토큰</p>
          </div>
        </section>

        <section className="hc-readable-box rounded-xl bg-surface p-md">
          <h2 className="mb-md font-label-md text-label-md font-semibold text-on-surface">회원정보 / 승인</h2>
          <div className="space-y-sm">
            {users.map((item) => (
              <article key={item.id} className="rounded-xl border border-outline-variant/30 p-md">
                <div className="flex items-start justify-between gap-sm">
                  <div className="min-w-0">
                    <p className="font-label-md text-label-md font-semibold text-on-surface">{item.nickname}</p>
                    <p className="truncate font-label-sm text-label-sm text-on-surface-variant">{item.email || item.id}</p>
                    <p className="mt-xs font-label-sm text-label-sm text-on-surface-variant">
                      토큰 {item.tokenCount + (item.hasLegacyToken ? 1 : 0)} · {item.coupleId ? '커플 연결됨' : '미연결'}
                    </p>
                  </div>
                  {item.approved ? (
                    <span className="rounded-full bg-primary px-sm py-xs font-label-sm text-label-sm text-on-primary">승인됨</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void approveUser(item.id)}
                      className="min-h-[50px] rounded-full bg-primary px-md font-label-sm text-label-sm text-on-primary"
                    >
                      승인
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="hc-readable-box rounded-xl bg-surface p-md">
          <h2 className="mb-md font-label-md text-label-md font-semibold text-on-surface">서비스 점검 모드</h2>
          <p className="mb-md font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
            켜면 {ADMIN_EMAIL} 을 제외한 모든 접속이 점검 공지 화면에서 멈춰요. 대화·일기 같은 앱 데이터는
            아예 불러오지 않습니다. 관리자 계정은 그대로 사용할 수 있어요.
          </p>

          <div className="mb-md flex items-center gap-sm rounded-xl border border-outline-variant/40 p-md">
            <span
              className="material-symbols-outlined"
              style={{ color: maintenance.enabled ? 'var(--color-error)' : 'var(--color-primary)' }}
            >
              {maintenance.enabled ? 'construction' : 'check_circle'}
            </span>
            <span className="font-label-md text-label-md font-semibold text-on-surface">
              현재 상태: {maintenance.enabled ? '점검 중 — 외부 접속 차단' : '정상 운영 중'}
            </span>
          </div>

          <label className="mb-xs block font-label-sm text-label-sm text-on-surface-variant" htmlFor="maintenance-notice">
            점검 공지 문구
          </label>
          <textarea
            id="maintenance-notice"
            value={noticeInput}
            onChange={(event) => setNoticeInput(event.target.value)}
            rows={3}
            className="mb-md w-full rounded-xl border border-outline-variant bg-surface-container-low p-md font-body-md text-body-md text-on-surface"
            placeholder="점검 안내 문구를 적어주세요"
          />

          <button
            type="button"
            disabled={maintenanceControl.saving}
            onClick={() => void maintenanceControl.setMaintenance(!maintenance.enabled, noticeInput)}
            className="min-h-[50px] w-full rounded-full px-lg font-label-md text-label-md disabled:opacity-50"
            style={{
              background: maintenance.enabled ? 'var(--color-primary)' : 'var(--color-error)',
              color: maintenance.enabled ? 'var(--color-on-primary)' : 'var(--color-on-error)',
            }}
          >
            {maintenanceControl.saving
              ? '저장 중...'
              : maintenance.enabled
                ? '점검 종료하고 서비스 재개'
                : '점검 모드 켜기 (외부 접속 차단)'}
          </button>
          {maintenanceControl.error && (
            <p className="mt-sm font-label-sm text-label-sm text-error">{maintenanceControl.error}</p>
          )}
        </section>

        <section className="hc-readable-box rounded-xl bg-surface p-md">
          <h2 className="mb-md font-label-md text-label-md font-semibold text-on-surface">상태 태그 추가/삭제</h2>
          <div className="mb-md flex gap-sm">
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              className="min-h-[50px] flex-1 rounded-xl border border-outline-variant bg-surface-container-low px-md text-on-surface"
              placeholder="예: 회복중"
            />
            <button type="button" onClick={() => void addTag()} className="min-h-[50px] rounded-full bg-primary px-md text-on-primary">
              추가
            </button>
          </div>
          <div className="flex flex-wrap gap-xs">
            {tags.map((tag) => (
              <button key={tag} type="button" onClick={() => void removeTag(tag)} className="rounded-full border border-outline-variant px-sm py-xs text-on-surface">
                {tag} ×
              </button>
            ))}
          </div>
        </section>

        <section className="hc-readable-box rounded-xl bg-surface p-md">
          <h2 className="mb-md font-label-md text-label-md font-semibold text-on-surface">로그</h2>
          <div className="space-y-sm">
            {logs.length === 0 ? (
              <p className="font-label-sm text-label-sm text-on-surface-variant">표시할 리포트 로그가 없어요.</p>
            ) : logs.map((log) => (
              <article key={log.id} className="rounded-xl border border-outline-variant/30 p-md">
                <p className="font-label-sm text-label-sm text-primary">{log.type} · {log.authorNickname} · {log.status}</p>
                <p className="mt-xs whitespace-pre-wrap font-body-sm text-body-sm text-on-surface">{log.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </SubScreen>
  )
}
