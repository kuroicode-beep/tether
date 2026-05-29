import { useState, useRef } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BottomNav } from '../components/BottomNav'
import { ImageViewer } from '../components/ImageViewer'
import { useDiary, DiaryEntry } from '../hooks/useDiary'
import { useApp } from '../context/AppContext'

type Screen = 'home' | 'chat' | 'diary' | 'more'
type View = 'list' | 'read' | 'write' | 'reply'

interface DiaryScreenProps {
  onNavigate: (screen: Screen) => void
}

function formatTs(ts: number | null): string {
  if (!ts) return '방금 전'
  try { return format(new Date(ts), 'M월 d일 (EEE)', { locale: ko }) } catch { return '' }
}

// ── 작성/답장 폼 ─────────────────────────────────────────────────────────────

interface WriteFormProps {
  isReply?: boolean
  onSubmit: (data: { title: string; content: string; imageFile?: File }) => void
  onCancel: () => void
}

function WriteForm({ isReply, onSubmit, onCancel }: WriteFormProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = () => {
    if (!content.trim()) return
    onSubmit({ title: title.trim(), content: content.trim(), imageFile: imageFile ?? undefined })
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#EEE9DC]">
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md flex items-center justify-between px-margin-mobile py-sm">
        <button onClick={onCancel} className="p-xs rounded-full hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined text-primary">close</span>
        </button>
        <h1 className="font-label-md text-label-md font-semibold text-on-surface">
          {isReply ? '답장 쓰기' : '일기 쓰기'}
        </h1>
        <button
          onClick={handleSubmit}
          disabled={!content.trim()}
          className="px-lg py-xs bg-primary text-on-primary rounded-full font-label-md text-label-md disabled:opacity-40 active:scale-95 transition-transform"
        >
          저장
        </button>
      </header>

      <main className="flex-1 px-margin-mobile py-lg space-y-md overflow-y-auto">
        {!isReply && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력해주세요"
            maxLength={50}
            className="w-full bg-transparent font-headline-md text-headline-md text-on-surface placeholder-on-surface-variant/40 outline-none border-b border-outline-variant/30 pb-sm"
          />
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="오늘 하루는 어땠나요?"
          rows={10}
          className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder-on-surface-variant/40 outline-none resize-none leading-relaxed"
        />
        {preview && (
          <div className="relative">
            <img src={preview} alt="첨부" className="w-full rounded-xl object-cover max-h-60" />
            <button
              onClick={() => { setImageFile(null); setPreview(null) }}
              className="absolute top-sm right-sm w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-white text-sm">close</span>
            </button>
          </div>
        )}
      </main>

      <footer className="px-margin-mobile pb-xl">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-sm text-secondary font-label-md text-label-md"
        >
          <span className="material-symbols-outlined">add_photo_alternate</span>
          사진 첨부
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </footer>
    </div>
  )
}

// ── 읽기 뷰 ─────────────────────────────────────────────────────────────────

interface ReadViewProps {
  entry: DiaryEntry
  myUid: string
  myNickname: string
  partnerNickname: string
  onBack: () => void
  onReply: () => void
  onImageTap: (url: string) => void
}

function ReadView({ entry, myUid, myNickname, partnerNickname, onBack, onReply, onImageTap }: ReadViewProps) {
  const isMe = entry.authorUid === myUid
  const authorName = isMe ? myNickname : partnerNickname

  return (
    <div className="flex flex-col min-h-screen bg-[#EEE9DC]">
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md flex items-center px-margin-mobile py-sm gap-md">
        <button onClick={onBack} className="p-xs rounded-full hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined text-primary">arrow_back</span>
        </button>
        <span className="font-label-md text-label-md text-on-surface-variant">{formatTs(entry.createdAt)}</span>
      </header>

      <main className="flex-1 px-margin-mobile py-lg overflow-y-auto pb-32">
        {/* 작성자 */}
        <div className="flex items-center gap-sm mb-lg">
          <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center font-bold text-primary text-sm">
            {authorName.slice(0, 1)}
          </div>
          <span className="font-label-md text-label-md text-on-surface font-semibold">{authorName}</span>
        </div>

        {/* 제목 */}
        {entry.title && (
          <h2 className="font-headline-md text-headline-md text-on-surface mb-md">{entry.title}</h2>
        )}

        {/* 본문 */}
        <p className="font-body-md text-body-md text-on-surface leading-relaxed whitespace-pre-wrap mb-lg">
          {entry.content}
        </p>

        {/* 첨부 이미지 */}
        {entry.imageUrl && (
          <button onClick={() => onImageTap(entry.imageUrl!)} className="w-full mb-lg active:scale-95 transition-transform">
            <img src={entry.imageUrl} alt="첨부 이미지" className="w-full rounded-xl object-cover max-h-72" />
          </button>
        )}

        {/* 구분선 */}
        {entry.reply && <div className="h-px bg-outline-variant/30 my-lg" />}

        {/* 답장 */}
        {entry.reply && (
          <div className="bg-surface-container/60 rounded-xl p-md">
            <div className="flex items-center gap-sm mb-sm">
              <span className="material-symbols-outlined text-primary text-sm">reply</span>
              <span className="font-label-sm text-label-sm text-primary font-semibold">
                {entry.reply.authorUid === myUid ? myNickname : partnerNickname}의 답장
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant ml-auto">
                {formatTs(entry.reply.createdAt)}
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface leading-relaxed whitespace-pre-wrap">
              {entry.reply.content}
            </p>
            {entry.reply.imageUrl && (
              <button onClick={() => onImageTap(entry.reply!.imageUrl!)} className="mt-sm w-full active:scale-95">
                <img src={entry.reply.imageUrl} alt="답장 이미지" className="w-full rounded-xl object-cover max-h-48" />
              </button>
            )}
          </div>
        )}
      </main>

      {/* 답장 버튼 */}
      {!entry.reply && !isMe && (
        <div className="fixed bottom-0 left-0 right-0 px-margin-mobile pb-xl pt-md bg-gradient-to-t from-[#EEE9DC] to-transparent">
          <button
            onClick={onReply}
            className="w-full bg-primary text-on-primary rounded-full py-md font-label-md text-label-md active:scale-95 transition-transform"
          >
            답장 쓰기 💌
          </button>
        </div>
      )}
    </div>
  )
}

// ── 메인 DiaryScreen ─────────────────────────────────────────────────────────

export function DiaryScreen({ onNavigate }: DiaryScreenProps) {
  const { uid, coupleId, myNickname, partnerNickname } = useApp()
  const { entries, writeDiary, markDiaryRead, writeReply } = useDiary(coupleId, uid)
  const [view, setView] = useState<View>('list')
  const [selected, setSelected] = useState<DiaryEntry | null>(null)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)

  const myName = myNickname || '나'
  const partnerName = partnerNickname || '자기'

  const handleCardTap = async (entry: DiaryEntry) => {
    setSelected(entry)
    setView('read')
    // 상대방 일기이고 미읽음이면 읽음 처리
    if (entry.authorUid !== uid && !entry.isRead) {
      await markDiaryRead(entry.id)
    }
  }

  const handleWriteSubmit = async (data: { title: string; content: string; imageFile?: File }) => {
    await writeDiary(data)
    setView('list')
  }

  const handleReplySubmit = async (data: { title: string; content: string; imageFile?: File }) => {
    if (!selected) return
    await writeReply(selected.id, { content: data.content, imageFile: data.imageFile })
    setView('list')
    setSelected(null)
  }

  // 뷰 분기
  if (view === 'write') {
    return <WriteForm onSubmit={handleWriteSubmit} onCancel={() => setView('list')} />
  }
  if (view === 'reply') {
    return <WriteForm isReply onSubmit={handleReplySubmit} onCancel={() => setView('read')} />
  }
  if (view === 'read' && selected) {
    return (
      <>
        <ReadView
          entry={selected}
          myUid={uid ?? ''}
          myNickname={myName}
          partnerNickname={partnerName}
          onBack={() => { setView('list'); setSelected(null) }}
          onReply={() => setView('reply')}
          onImageTap={setViewerUrl}
        />
        {viewerUrl && <ImageViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />}
      </>
    )
  }

  // 목록
  return (
    <div className="bg-background text-on-background min-h-screen pb-32">
      <header className="w-full top-0 sticky z-50 bg-surface flex justify-between items-center px-margin-mobile py-sm">
        <div className="flex items-center gap-md">
          <button
            onClick={() => onNavigate('home')}
            className="p-xs rounded-full hover:bg-surface-container transition-colors"
            style={{ color: 'var(--color-text)' }}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline-md text-headline-md font-semibold text-primary">교환일기 💌</h1>
        </div>
        <button
          onClick={() => setView('write')}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-primary"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>
      </header>

      <main className="max-w-[600px] mx-auto px-margin-mobile pb-32 pt-md">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-xxl text-center gap-md">
            <span className="material-symbols-outlined text-[56px] text-primary/30" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_stories
            </span>
            <p className="font-body-md text-body-md text-on-surface-variant">
              첫 일기를 써보세요 💕
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            {entries.map((entry) => {
              const isMe = entry.authorUid === uid
              const authorName = isMe ? myName : partnerName
              const isUnread = !isMe && !entry.isRead

              return (
                <button
                  key={entry.id}
                  onClick={() => handleCardTap(entry)}
                  className={`relative bg-[#F5F2EB] rounded-xl border-l-[5px] p-md shadow-sm text-left transition-all active:scale-[0.98] ${
                    isMe ? 'border-l-primary/60' : isUnread ? 'border-l-secondary' : 'border-l-outline-variant/40'
                  } ${isUnread ? 'shadow-md' : ''}`}
                >
                  {/* 헤더 */}
                  <div className="flex justify-between items-start mb-sm">
                    <div className="flex items-center gap-sm">
                      <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-primary text-xs font-bold">
                        {authorName.slice(0, 1)}
                      </div>
                      <div>
                        <p className="font-label-md text-label-md font-semibold text-on-surface">{authorName}</p>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">{formatTs(entry.createdAt)}</p>
                      </div>
                    </div>
                    <span className={`px-sm py-xs rounded-full text-[10px] font-bold tracking-tight ${
                      isUnread
                        ? 'bg-primary-container text-on-primary-container'
                        : entry.reply
                        ? 'bg-secondary-container text-on-surface-variant'
                        : 'bg-surface-variant text-on-surface-variant'
                    }`}>
                      {isUnread ? '새 일기' : entry.reply ? '답장 완료 ✅' : '읽음'}
                    </span>
                  </div>

                  {/* 내용 */}
                  {entry.title && (
                    <h3 className="font-label-md text-label-md font-semibold text-on-surface mb-xs">{entry.title}</h3>
                  )}
                  <p className={`font-body-md text-body-md text-on-surface-variant line-clamp-2 leading-snug ${isUnread ? 'blur-sm select-none' : ''}`}>
                    {entry.content}
                  </p>

                  {isUnread && (
                    <div className="mt-sm flex items-center gap-xs">
                      <span className="material-symbols-outlined text-primary-container text-sm">lock</span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">탭해서 열어보기</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </main>

      <BottomNav active="diary" onNavigate={onNavigate} />
    </div>
  )
}
