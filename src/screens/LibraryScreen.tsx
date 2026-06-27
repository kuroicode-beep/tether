import { useCallback, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BottomNav } from '../components/BottomNav'
import { ScreenHeader } from '../components/ScreenHeader'
import { SubScreen } from '../components/SubScreen'
import { useApp } from '../context/useApp'
import { useCoupleSession } from '../hooks/useCoupleSession'
import { useLibrary } from '../hooks/useLibrary'

interface LibraryScreenProps {
  onBack: () => void
  onNavigate: (screen: 'home' | 'chat' | 'diary' | 'more') => void
}

interface StandaloneScreenProps {
  onBack: () => void
  onNavigate: (screen: 'home' | 'chat' | 'diary' | 'more') => void
}

function formatFileSize(size: number | null): string {
  if (!size) return ''
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))}KB`
  return `${(size / 1024 / 1024).toFixed(1)}MB`
}

function formatTime(ts: number | null): string {
  if (!ts) return ''
  try {
    return format(new Date(ts), 'M월 d일 a h:mm', { locale: ko })
  } catch {
    return ''
  }
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

// MIME이 비어 있는 모바일 파일도 확장자로 오디오 여부를 판별한다.
function isAudioFile(fileName: string, fileType: string): boolean {
  return fileType.startsWith('audio/') || /\.(mp3|m4a|wav|aac|ogg|flac)$/i.test(fileName)
}

function LinkSheet({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (data: { title: string; url: string; summary?: string; file?: File | null }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [summary, setSummary] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim() || !url.trim() || saving) return
    setSaving(true)
    await onSave({ title, url: normalizeUrl(url), summary, file })
    setSaving(false)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="app-fixed-x fixed bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-surface px-margin-mobile pb-xxl pt-lg shadow-2xl">
        <div className="mx-auto mb-lg h-1 w-10 rounded-full bg-outline-variant" />
        <h2 className="mb-lg font-label-md text-label-md font-semibold text-on-surface">즐겨찾기 공유</h2>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="사이트명"
          autoFocus
          className="mb-sm w-full rounded-xl bg-surface-container px-lg py-md font-body-md text-body-md text-on-surface outline-none placeholder-on-surface-variant/40"
        />
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="URL"
          inputMode="url"
          className="mb-sm w-full rounded-xl bg-surface-container px-lg py-md font-body-md text-body-md text-on-surface outline-none placeholder-on-surface-variant/40"
        />
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="요약 설명"
          rows={3}
          className="mb-sm w-full resize-none rounded-xl bg-surface-container px-lg py-md font-body-md text-body-md text-on-surface outline-none placeholder-on-surface-variant/40"
        />
        <label className="mb-lg flex min-h-[50px] cursor-pointer items-center justify-center gap-sm rounded-xl border border-outline-variant/30 bg-surface-container px-lg py-sm font-label-md text-label-md text-on-surface-variant">
          <span className="material-symbols-outlined text-base">attach_file</span>
          {file ? file.name : '바로가기 파일 업로드 (선택)'}
          <input type="file" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!title.trim() || !url.trim() || saving}
          className="min-h-[50px] w-full rounded-full bg-primary px-md font-label-md text-label-md text-on-primary disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </>
  )
}

function RecipeSheet({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (data: { date: string; food: string; memo?: string }) => Promise<void>
}) {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [food, setFood] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!date || !food.trim() || saving) return
    setSaving(true)
    await onSave({ date, food, memo })
    setSaving(false)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="app-fixed-x fixed bottom-0 z-50 rounded-t-3xl bg-surface px-margin-mobile pb-xxl pt-lg shadow-2xl">
        <div className="mx-auto mb-lg h-1 w-10 rounded-full bg-outline-variant" />
        <h2 className="mb-lg font-label-md text-label-md font-semibold text-on-surface">데이트 레시피 기록</h2>
        <input
          value={date}
          onChange={(event) => setDate(event.target.value)}
          type="date"
          className="mb-sm w-full rounded-xl bg-surface-container px-lg py-md font-body-md text-body-md text-on-surface outline-none"
        />
        <input
          value={food}
          onChange={(event) => setFood(event.target.value)}
          placeholder="같이 먹은 음식"
          autoFocus
          className="mb-sm w-full rounded-xl bg-surface-container px-lg py-md font-body-md text-body-md text-on-surface outline-none placeholder-on-surface-variant/40"
        />
        <input
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          placeholder="메모 (선택)"
          className="mb-lg w-full rounded-xl bg-surface-container px-lg py-md font-body-md text-body-md text-on-surface outline-none placeholder-on-surface-variant/40"
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!date || !food.trim() || saving}
          className="min-h-[50px] w-full rounded-full bg-primary px-md font-label-md text-label-md text-on-primary disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </>
  )
}

export function LibraryScreen({ onBack, onNavigate }: LibraryScreenProps) {
  const { uid, coupleId } = useCoupleSession()
  const { myNickname, partnerNickname, partnerUid } = useApp()
  const { files, deleteFile } = useLibrary(coupleId, uid)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const nameOf = useCallback((senderUid: string) => {
    if (senderUid === uid) return myNickname || '나'
    if (senderUid === partnerUid) return partnerNickname || '자기'
    return '우리'
  }, [myNickname, partnerNickname, partnerUid, uid])

  const filteredFiles = useMemo(() => {
    const libraryFiles = files.filter((item) => !isAudioFile(item.fileName, item.fileType))
    const keyword = search.trim().toLowerCase()
    if (!keyword) return libraryFiles
    return libraryFiles.filter((item) => {
      const haystack = [
        item.fileName,
        item.fileType,
        nameOf(item.senderUid),
        formatTime(item.createdAt),
      ].join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
  }, [files, search, nameOf])

  const libraryFileCount = useMemo(
    () => files.filter((item) => !isAudioFile(item.fileName, item.fileType)).length,
    [files],
  )

  const handleDeleteFile = async (id: string) => {
    if (deletingId) return
    if (!window.confirm('이 파일을 자료실과 채팅에서 삭제할까요?')) return
    setDeletingId(id)
    setDeleteError('')
    const ok = await deleteFile(id)
    if (!ok) setDeleteError('삭제하지 못했어요. 내가 보낸 파일만 삭제할 수 있어요.')
    setDeletingId(null)
  }

  return (
    <SubScreen>
      <ScreenHeader title="자료실" onBack={onBack} />

      <main className="sub-screen-body space-y-sm px-margin-mobile pb-32 pt-sm">
        <label className="hc-readable-box flex min-h-[50px] items-center gap-sm rounded-xl bg-surface px-md py-sm">
          <span className="material-symbols-outlined text-primary">search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="파일명, 보낸 사람, 형식 검색"
            className="min-w-0 flex-1 bg-transparent font-body-md text-body-md text-on-surface outline-none placeholder-on-surface-variant/50"
          />
        </label>
        {deleteError && (
          <p className="hc-readable-box rounded-xl bg-surface p-sm font-label-sm text-label-sm text-error">
            {deleteError}
          </p>
        )}
        {libraryFileCount === 0 ? (
          <p className="hc-readable-box rounded-xl bg-surface p-lg text-center font-body-md text-body-md text-on-surface-variant">
            채팅에서 문서, 압축파일, 기타 파일을 올리면 여기에 모여요. 음악 파일은 같이듣기에서 확인할 수 있어요.
          </p>
        ) : filteredFiles.length === 0 ? (
          <p className="hc-readable-box rounded-xl bg-surface p-lg text-center font-body-md text-body-md text-on-surface-variant">
            검색 결과가 없어요.
          </p>
        ) : filteredFiles.map((item) => {
          const canDelete = item.senderUid === uid
          return (
          <article key={item.id} className="hc-readable-box rounded-xl bg-surface p-md">
            <div className="flex items-start gap-sm">
              <span className="material-symbols-outlined text-primary">
                draft
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-label-md text-label-md font-semibold text-on-surface">{item.fileName}</p>
                <p className="mt-xs font-label-sm text-label-sm text-on-surface-variant">
                  {nameOf(item.senderUid)} 님 · {formatFileSize(item.fileSize)} · {formatTime(item.createdAt)}
                </p>
                <div className="mt-sm flex flex-col gap-sm">
                  <a href={item.fileUrl} target="_blank" rel="noreferrer" download={item.fileName} className="inline-flex min-h-[44px] w-fit items-center rounded-full border border-primary px-md font-label-sm text-label-sm text-primary">
                    열기 / 다운로드
                  </a>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteFile(item.id)}
                      disabled={deletingId === item.id}
                      className="inline-flex min-h-[44px] w-fit items-center rounded-full border border-error px-md font-label-sm text-label-sm text-error disabled:opacity-40"
                    >
                      {deletingId === item.id ? '삭제 중...' : '삭제'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </article>
          )
        })}
      </main>

      <BottomNav active="more" onNavigate={onNavigate} />
    </SubScreen>
  )
}

export function LinkShareScreen({ onBack, onNavigate }: StandaloneScreenProps) {
  const { uid, coupleId } = useCoupleSession()
  const { links, addLink } = useLibrary(coupleId, uid)
  const [showLinkSheet, setShowLinkSheet] = useState(false)

  return (
    <SubScreen>
      <ScreenHeader
        title="링크공유"
        onBack={onBack}
        right={(
          <button type="button" onClick={() => setShowLinkSheet(true)} className="min-h-[44px] rounded-full px-sm text-primary" aria-label="링크 추가">
            <span className="material-symbols-outlined">add_link</span>
          </button>
        )}
      />

      <main className="sub-screen-body space-y-sm px-margin-mobile pb-32 pt-sm">
        {links.length === 0 ? (
          <div className="hc-readable-box rounded-xl bg-surface p-lg text-center">
            <p className="mb-md font-body-md text-body-md text-on-surface-variant">공유한 링크가 없어요.</p>
            <button type="button" onClick={() => setShowLinkSheet(true)} className="min-h-[50px] rounded-full bg-primary px-lg font-label-md text-label-md text-on-primary">
              링크 추가
            </button>
          </div>
        ) : links.map((item) => (
          <article key={item.id} className="hc-readable-box rounded-xl bg-surface p-md">
            <p className="font-label-md text-label-md font-semibold text-on-surface">{item.title}</p>
            {item.summary && <p className="mt-xs whitespace-pre-wrap font-body-sm text-body-sm text-on-surface-variant">{item.summary}</p>}
            <div className="mt-sm flex flex-wrap gap-xs">
              <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center rounded-full border border-primary px-md font-label-sm text-label-sm text-primary">
                사이트 열기
              </a>
              {item.fileUrl && (
                <a href={item.fileUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center rounded-full border border-outline-variant px-md font-label-sm text-label-sm text-on-surface">
                  {item.fileName || '파일 열기'}
                </a>
              )}
            </div>
          </article>
        ))}
      </main>

      <BottomNav active="more" onNavigate={onNavigate} />

      {showLinkSheet && (
        <LinkSheet onClose={() => setShowLinkSheet(false)} onSave={addLink} />
      )}
    </SubScreen>
  )
}

export function DateRecipeScreen({ onBack, onNavigate }: StandaloneScreenProps) {
  const { uid, coupleId } = useCoupleSession()
  const { recipes, addRecipe } = useLibrary(coupleId, uid)
  const [showRecipeSheet, setShowRecipeSheet] = useState(false)

  return (
    <SubScreen>
      <ScreenHeader
        title="데이트 레시피"
        onBack={onBack}
        right={(
          <button type="button" onClick={() => setShowRecipeSheet(true)} className="min-h-[44px] rounded-full px-sm text-primary" aria-label="기록 추가">
            <span className="material-symbols-outlined">add</span>
          </button>
        )}
      />

      <main className="sub-screen-body space-y-sm px-margin-mobile pb-32 pt-sm">
        {recipes.length === 0 ? (
          <div className="hc-readable-box rounded-xl bg-surface p-lg text-center">
            <p className="mb-md font-body-md text-body-md text-on-surface-variant">같이 먹은 음식을 한 줄로 남겨보세요.</p>
            <button type="button" onClick={() => setShowRecipeSheet(true)} className="min-h-[50px] rounded-full bg-primary px-lg font-label-md text-label-md text-on-primary">
              기록 추가
            </button>
          </div>
        ) : recipes.map((item) => (
          <article key={item.id} className="hc-readable-box rounded-xl bg-surface p-md">
            <p className="font-label-md text-label-md font-semibold text-on-surface">
              {item.date} · {item.food}
            </p>
            {item.memo && <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">{item.memo}</p>}
          </article>
        ))}
      </main>

      <BottomNav active="more" onNavigate={onNavigate} />

      {showRecipeSheet && (
        <RecipeSheet onClose={() => setShowRecipeSheet(false)} onSave={addRecipe} />
      )}
    </SubScreen>
  )
}
