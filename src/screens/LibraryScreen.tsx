import { useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BottomNav } from '../components/BottomNav'
import { ScreenHeader } from '../components/ScreenHeader'
import { SubScreen } from '../components/SubScreen'
import { useApp } from '../context/AppContext'
import { useCoupleSession } from '../hooks/useCoupleSession'
import { useLibrary } from '../hooks/useLibrary'

type LibraryTab = 'files' | 'links' | 'recipes'

interface LibraryScreenProps {
  onBack: () => void
  onNavigate: (screen: 'home' | 'chat' | 'diary' | 'more') => void
}

const TABS: { id: LibraryTab; label: string; icon: string }[] = [
  { id: 'files', label: '자료실', icon: 'folder_open' },
  { id: 'links', label: '링크공유', icon: 'bookmark' },
  { id: 'recipes', label: '데이트 레시피', icon: 'restaurant' },
]

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
  const { files, links, recipes, addLink, addRecipe } = useLibrary(coupleId, uid)
  const [tab, setTab] = useState<LibraryTab>('files')
  const [showLinkSheet, setShowLinkSheet] = useState(false)
  const [showRecipeSheet, setShowRecipeSheet] = useState(false)

  const nameOf = (senderUid: string) => {
    if (senderUid === uid) return myNickname || '나'
    if (senderUid === partnerUid) return partnerNickname || '자기'
    return '우리'
  }

  return (
    <SubScreen>
      <ScreenHeader
        title="자료실"
        onBack={onBack}
        right={tab === 'links' ? (
          <button type="button" onClick={() => setShowLinkSheet(true)} className="min-h-[44px] rounded-full px-sm text-primary">
            <span className="material-symbols-outlined">add_link</span>
          </button>
        ) : tab === 'recipes' ? (
          <button type="button" onClick={() => setShowRecipeSheet(true)} className="min-h-[44px] rounded-full px-sm text-primary">
            <span className="material-symbols-outlined">add</span>
          </button>
        ) : undefined}
      />

      <div className="flex gap-sm overflow-x-auto px-margin-mobile py-sm hide-scrollbar">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex min-h-[44px] flex-none items-center gap-xs rounded-full px-md font-label-md text-label-md ${
              tab === item.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <main className="sub-screen-body space-y-sm px-margin-mobile pb-32 pt-sm">
        {tab === 'files' && (
          files.length === 0 ? (
            <p className="hc-readable-box rounded-xl bg-surface p-lg text-center font-body-md text-body-md text-on-surface-variant">
              채팅에서 파일이나 음악을 올리면 여기에 모여요.
            </p>
          ) : files.map((item) => (
            <article key={item.id} className="hc-readable-box rounded-xl bg-surface p-md">
              <div className="flex items-start gap-sm">
                <span className="material-symbols-outlined text-primary">
                  {item.fileType.startsWith('audio/') ? 'audio_file' : 'draft'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-label-md text-label-md font-semibold text-on-surface">{item.fileName}</p>
                  <p className="mt-xs font-label-sm text-label-sm text-on-surface-variant">
                    {nameOf(item.senderUid)} 님 · {formatFileSize(item.fileSize)} · {formatTime(item.createdAt)}
                  </p>
                  {item.fileType.startsWith('audio/') ? (
                    <audio controls src={item.fileUrl} className="mt-sm w-full" />
                  ) : (
                    <a href={item.fileUrl} target="_blank" rel="noreferrer" className="mt-sm inline-flex min-h-[44px] items-center rounded-full border border-primary px-md font-label-sm text-label-sm text-primary">
                      열기
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))
        )}

        {tab === 'links' && (
          links.length === 0 ? (
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
          ))
        )}

        {tab === 'recipes' && (
          recipes.length === 0 ? (
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
          ))
        )}
      </main>

      <BottomNav active="more" onNavigate={onNavigate} />

      {showLinkSheet && (
        <LinkSheet onClose={() => setShowLinkSheet(false)} onSave={addLink} />
      )}
      {showRecipeSheet && (
        <RecipeSheet onClose={() => setShowRecipeSheet(false)} onSave={addRecipe} />
      )}
    </SubScreen>
  )
}
