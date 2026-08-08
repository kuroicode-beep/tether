// src/screens/RelayNovelScreen.tsx
// 릴레이소설 서재 — 일시중지된 이야기 재개, 완결본 목록과 본문 보기, 문서 내려받기.
import { useCallback, useEffect, useState } from 'react'
import { SubScreen } from '../components/SubScreen'
import { ScreenHeader } from '../components/ScreenHeader'
import { useCoupleSession } from '../hooks/useCoupleSession'
import { fetchCompletedNovels, fetchPausedNovels, resumeNovel } from '../hooks/useRelayNovel'
import { buildNovelDocument, type RelayNovel } from '../lib/relayNovel'

interface RelayNovelScreenProps {
  onBack: () => void
}

function formatDate(ms: number | null): string {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function RelayNovelScreen({ onBack }: RelayNovelScreenProps) {
  const { coupleId } = useCoupleSession()
  const [novels, setNovels] = useState<RelayNovel[]>([])
  const [pausedNovels, setPausedNovels] = useState<RelayNovel[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [openNovel, setOpenNovel] = useState<RelayNovel | null>(null)
  const [resumingId, setResumingId] = useState<string | null>(null)
  const [resumedTitle, setResumedTitle] = useState<string | null>(null)

  useEffect(() => {
    if (!coupleId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setFailed(false)
    Promise.all([fetchCompletedNovels(coupleId), fetchPausedNovels(coupleId)])
      .then(([completed, paused]) => {
        if (cancelled) return
        setNovels(completed)
        setPausedNovels(paused)
      })
      .catch((err) => {
        console.warn('[RelayNovel] 목록을 불러오지 못했어요', err)
        if (!cancelled) setFailed(true)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [coupleId])

  // 일시중지된 이야기를 재개한다 — 진행 중이던 다른 이야기는 자동 일시중지
  const handleResume = useCallback(async (novel: RelayNovel) => {
    if (!coupleId || resumingId) return
    setResumingId(novel.id)
    try {
      await resumeNovel(coupleId, novel.id)
      setPausedNovels((list) => list.filter((n) => n.id !== novel.id))
      setResumedTitle(novel.title)
    } catch (err) {
      console.warn('[RelayNovel] 재개하지 못했어요', err)
    } finally {
      setResumingId(null)
    }
  }, [coupleId, resumingId])

  // 완결본을 마크다운 문서로 내려받는다
  const handleDownload = useCallback((novel: RelayNovel) => {
    const blob = new Blob([buildNovelDocument(novel)], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = novel.completedAt ? new Date(novel.completedAt) : new Date()
    const date = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(stamp.getDate()).padStart(2, '0')}`
    link.href = url
    link.download = `릴레이소설_${date}_${novel.title.replace(/\s+/g, '_')}.md`
    link.click()
    URL.revokeObjectURL(url)
  }, [])

  if (openNovel) {
    return (
      <SubScreen>
        <ScreenHeader title={openNovel.title} onBack={() => setOpenNovel(null)} />
        <div className="sub-screen-body px-margin-mobile pb-xxl">
          <p className="font-label-md text-label-md text-on-surface-variant mt-md mb-lg">
            {formatDate(openNovel.completedAt)} 완결 · {openNovel.turnCount}턴
          </p>

          {openNovel.turns.map((turn, index) => (
            <article key={`${turn.at}-${index}`} className="relay-read-turn">
              <div className="relay-turn-head">
                <span className="relay-turn-number">{index + 1}</span>
                <span className="relay-turn-author">{turn.authorName}</span>
                {turn.bySidekick && <span className="relay-turn-tag">이어쓰기 도움</span>}
              </div>
              <p className="relay-turn-text">{turn.text}</p>
            </article>
          ))}

          <button
            type="button"
            onClick={() => handleDownload(openNovel)}
            className="btn-outline w-full mt-xl"
          >
            문서 파일로 저장
          </button>
        </div>
      </SubScreen>
    )
  }

  return (
    <SubScreen>
      <ScreenHeader title="릴레이소설" onBack={onBack} />
      <div className="sub-screen-body px-margin-mobile pb-xxl">
        <p className="font-body-md text-body-md text-on-surface-variant mt-md mb-lg">
          채팅에서 <strong className="text-on-surface">/릴레이소설 시작</strong> 으로 함께 쓰고,
          <strong className="text-on-surface"> /릴레이소설 완결</strong> 하면 여기에 보관돼요.
        </p>

        {loading && (
          <p className="font-body-md text-body-md text-on-surface-variant py-xl text-center">
            불러오는 중이에요...
          </p>
        )}

        {!loading && failed && (
          <p className="font-body-md text-body-md text-on-surface-variant py-xl text-center">
            목록을 불러오지 못했어요. 잠시 후 다시 열어주세요.
          </p>
        )}

        {resumedTitle && (
          <p className="relay-resume-notice" role="status">
            「{resumedTitle}」를 다시 시작했어요. 채팅 상단에서 이어서 써주세요.
          </p>
        )}

        {!loading && !failed && pausedNovels.length > 0 && (
          <>
            <p className="font-label-md text-label-md text-on-surface font-semibold mb-sm">
              잠시 멈춘 이야기
            </p>
            {pausedNovels.map((novel) => (
              <div key={novel.id} className="relay-card relay-card--paused">
                <div className="relay-card-head">
                  <span className="material-symbols-outlined relay-card-icon" aria-hidden="true">
                    pause_circle
                  </span>
                  <span className="relay-card-title">{novel.title}</span>
                </div>
                <p className="relay-card-meta">
                  {formatDate(novel.startedAt)} 시작 · {novel.turnCount}턴 · 일시중지
                </p>
                {novel.turns[0] && <p className="relay-card-preview">{novel.turns[0].text}</p>}
                <button
                  type="button"
                  className="btn-outline w-full mt-sm"
                  onClick={() => void handleResume(novel)}
                  disabled={resumingId === novel.id}
                >
                  {resumingId === novel.id ? '재개하는 중…' : '재개하기'}
                </button>
              </div>
            ))}
            <div className="mb-lg" />
          </>
        )}

        {!loading && !failed && novels.length === 0 && pausedNovels.length === 0 && (
          <div className="relay-empty">
            <span className="material-symbols-outlined relay-empty-icon" aria-hidden="true">
              history_edu
            </span>
            <p className="font-body-md text-body-md text-on-surface">아직 완결된 이야기가 없어요.</p>
            <p className="font-label-md text-label-md text-on-surface-variant mt-xs">
              채팅에서 첫 이야기를 시작해보세요.
            </p>
          </div>
        )}

        {novels.map((novel) => (
          <button
            key={novel.id}
            type="button"
            onClick={() => setOpenNovel(novel)}
            className="relay-card"
          >
            <div className="relay-card-head">
              <span className="material-symbols-outlined relay-card-icon" aria-hidden="true">
                menu_book
              </span>
              <span className="relay-card-title">{novel.title}</span>
            </div>
            <p className="relay-card-meta">
              {formatDate(novel.completedAt)} 완결 · {novel.turnCount}턴
            </p>
            {novel.turns[0] && <p className="relay-card-preview">{novel.turns[0].text}</p>}
          </button>
        ))}
      </div>
    </SubScreen>
  )
}
