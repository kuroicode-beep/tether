import { useState, useEffect } from 'react'
import { BottomNav } from '../components/BottomNav'
import { ContentActionSheet } from '../components/ContentActionSheet'
import { useContents, ContentCategory, ContentItem, ContentStatus } from '../hooks/useContents'
import { useUnreadBadges } from '../context/UnreadBadgesContext'
import { useApp } from '../context/AppContext'
import { useCoupleSession } from '../hooks/useCoupleSession'
import { ProfileAvatar } from '../components/ProfileAvatar'

type Screen = 'home' | 'chat' | 'diary' | 'more'
interface ContentsScreenProps { onNavigate: (screen: Screen) => void }

type FilterCategory = '전체' | ContentCategory
const CATEGORIES: FilterCategory[] = ['전체', 'book', 'movie', 'drama', 'youtube', 'etc']
const CATEGORY_LABEL: Record<ContentCategory, string> = {
  book: '📚 책', movie: '🎬 영화', drama: '📺 드라마', youtube: '▶️ 유튜브', etc: '📦 기타',
}
const CATEGORY_EMOJI: Record<ContentCategory, string> = {
  book: '📚', movie: '🎬', drama: '📺', youtube: '▶️', etc: '📦',
}
const STATUS_INFO: Record<ContentStatus, { text: string; className: string }> = {
  want:     { text: '💚 보고싶어요', className: 'bg-[#E8F5E9] text-[#2E7D32]' },
  watching: { text: '👀 보는 중',   className: 'bg-[#E3F2FD] text-[#1976D2]' },
  done:     { text: '✅ 다 봤어요', className: 'bg-primary-container text-on-primary-container' },
}

// ── 추가 바텀시트 ───────────────────────────────────────────────────────────

interface AddSheetProps {
  onAdd: (data: {
    category: ContentCategory
    title: string
    memo?: string
    url?: string
    imageFile?: File | null
  }) => void
  onClose: () => void
}

function AddSheet({ onAdd, onClose }: AddSheetProps) {
  const [category, setCategory] = useState<ContentCategory>('movie')
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [url, setUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImageFile(file)
    setPreviewUrl(file ? URL.createObjectURL(file) : null)
    e.target.value = ''
  }

  const handleClose = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    onClose()
  }

  const handleAdd = () => {
    if (!title.trim()) return
    onAdd({
      category,
      title: title.trim(),
      memo: memo.trim() || undefined,
      url: url.trim() || undefined,
      imageFile,
    })
    handleClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={handleClose} />
      <div className="app-fixed-x fixed bottom-0 z-50 bg-surface rounded-t-3xl px-margin-mobile pt-lg pb-xxl shadow-2xl">
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />
        <h2 className="font-label-md text-label-md font-semibold text-on-surface mb-lg">항목 추가</h2>

        {/* 카테고리 선택 */}
        <div className="grid grid-cols-5 gap-sm mb-lg">
          {(['book', 'movie', 'drama', 'youtube', 'etc'] as ContentCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex flex-col items-center gap-xs p-sm rounded-xl transition-colors ${
                category === cat ? 'bg-primary-container' : 'bg-surface-container'
              }`}
            >
              <span className="text-2xl">{CATEGORY_EMOJI[cat]}</span>
              <span className="text-[10px] text-on-surface-variant font-medium">
                {CATEGORY_LABEL[cat].split(' ')[1]}
              </span>
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력해주세요"
          autoFocus
          className="w-full bg-surface-container rounded-xl px-lg py-md font-body-md text-body-md text-on-surface placeholder-on-surface-variant/40 outline-none mb-sm"
        />
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          className="w-full bg-surface-container rounded-xl px-lg py-md font-body-md text-body-md text-on-surface placeholder-on-surface-variant/40 outline-none mb-lg"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL (선택)"
          inputMode="url"
          className="w-full bg-surface-container rounded-xl px-lg py-md font-body-md text-body-md text-on-surface placeholder-on-surface-variant/40 outline-none mb-sm"
        />
        <label className="mb-lg flex min-h-[50px] cursor-pointer items-center justify-center gap-sm rounded-xl border border-outline-variant/30 bg-surface-container px-lg py-sm font-label-md text-label-md text-on-surface-variant">
          <span className="material-symbols-outlined text-base">add_photo_alternate</span>
          {previewUrl ? '이미지 다시 선택' : '이미지 추가 (선택)'}
          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </label>
        {previewUrl && (
          <div className="mb-lg overflow-hidden rounded-xl bg-surface-container-low">
            <img src={previewUrl} alt="콘텐츠 이미지 미리보기" className="h-40 w-full object-cover" />
          </div>
        )}
        <button
          onClick={handleAdd}
          disabled={!title.trim()}
          className="w-full bg-primary text-on-primary rounded-full py-md font-label-md text-label-md disabled:opacity-40 active:scale-95 transition-transform"
        >
          추가하기
        </button>
      </div>
    </>
  )
}

// ── 완료 처리 바텀시트 ──────────────────────────────────────────────────────

interface DoneSheetProps {
  item: ContentItem
  onSave: (rating: number, review: string) => void
  onClose: () => void
}

function DoneSheet({ item, onSave, onClose }: DoneSheetProps) {
  const [rating, setRating] = useState(item.rating ?? 0)
  const [review, setReview] = useState(item.review ?? '')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="app-fixed-x fixed bottom-0 z-50 bg-surface rounded-t-3xl px-margin-mobile pt-lg pb-xxl shadow-2xl">
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />
        <h2 className="font-label-md text-label-md font-semibold text-on-surface mb-xs">다 봤어요! ✅</h2>
        <p className="font-label-sm text-label-sm text-on-surface-variant mb-lg">{item.title}</p>

        {/* 별점 */}
        <div className="flex justify-center gap-md mb-lg">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setRating(s)} className="text-3xl transition-transform active:scale-110">
              {s <= rating ? '⭐' : '☆'}
            </button>
          ))}
        </div>

        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="한줄 감상 (선택)"
          rows={2}
          className="w-full bg-surface-container rounded-xl px-lg py-md font-body-md text-body-md text-on-surface placeholder-on-surface-variant/40 outline-none resize-none mb-lg"
        />
        <button
          onClick={() => { onSave(rating, review.trim()); onClose() }}
          className="w-full bg-primary text-on-primary rounded-full py-md font-label-md text-label-md active:scale-95 transition-transform"
        >
          저장
        </button>
      </div>
    </>
  )
}

// ── 전체 수정 바텀시트 ──────────────────────────────────────────────────────

interface EditSheetProps {
  item: ContentItem
  onSave: (data: {
    category: ContentCategory
    title: string
    memo: string | null
    url: string | null
    imageUrl: string | null
    imagePath: string | null
    imageFile?: File | null
    status: ContentStatus
    rating: number | null
    review: string | null
  }) => void
  onClose: () => void
}

function EditSheet({ item, onSave, onClose }: EditSheetProps) {
  const [category, setCategory] = useState<ContentCategory>(item.category)
  const [title, setTitle] = useState(item.title)
  const [memo, setMemo] = useState(item.memo ?? '')
  const [url, setUrl] = useState(item.url ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(item.imageUrl)
  const [status, setStatus] = useState<ContentStatus>(item.status)
  const [rating, setRating] = useState(item.rating ?? 0)
  const [review, setReview] = useState(item.review ?? '')

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setImageFile(file)
    setPreviewUrl(file ? URL.createObjectURL(file) : item.imageUrl)
    e.target.value = ''
  }

  const clearImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setImageFile(null)
    setPreviewUrl(null)
  }

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      category,
      title: title.trim(),
      memo: memo.trim() || null,
      url: url.trim() || null,
      imageUrl: previewUrl?.startsWith('blob:') ? item.imageUrl : previewUrl,
      imagePath: previewUrl ? item.imagePath : null,
      imageFile,
      status,
      rating: status === 'done' ? rating || null : null,
      review: status === 'done' ? review.trim() || null : null,
    })
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="app-fixed-x fixed bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-surface px-margin-mobile pb-xxl pt-lg shadow-2xl">
        <div className="mx-auto mb-lg h-1 w-10 rounded-full bg-outline-variant" />
        <h2 className="mb-lg font-label-md text-label-md font-semibold text-on-surface">콘텐츠 수정</h2>

        <div className="mb-lg grid grid-cols-5 gap-sm">
          {(['book', 'movie', 'drama', 'youtube', 'etc'] as ContentCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex min-h-[58px] flex-col items-center gap-xs rounded-xl p-sm transition-colors ${
                category === cat ? 'bg-primary-container' : 'bg-surface-container'
              }`}
            >
              <span className="text-2xl">{CATEGORY_EMOJI[cat]}</span>
              <span className="text-[10px] font-medium text-on-surface-variant">
                {CATEGORY_LABEL[cat].split(' ')[1]}
              </span>
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          className="mb-sm w-full rounded-xl bg-surface-container px-lg py-md font-body-md text-body-md text-on-surface outline-none placeholder-on-surface-variant/40"
        />
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모"
          rows={3}
          className="mb-lg w-full resize-none rounded-xl bg-surface-container px-lg py-md font-body-md text-body-md text-on-surface outline-none placeholder-on-surface-variant/40"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL"
          inputMode="url"
          className="mb-sm w-full rounded-xl bg-surface-container px-lg py-md font-body-md text-body-md text-on-surface outline-none placeholder-on-surface-variant/40"
        />
        <label className="mb-sm flex min-h-[50px] cursor-pointer items-center justify-center gap-sm rounded-xl border border-outline-variant/30 bg-surface-container px-lg py-sm font-label-md text-label-md text-on-surface-variant">
          <span className="material-symbols-outlined text-base">add_photo_alternate</span>
          {previewUrl ? '이미지 다시 선택' : '이미지 추가'}
          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </label>
        {previewUrl && (
          <div className="mb-lg overflow-hidden rounded-xl bg-surface-container-low">
            <img src={previewUrl} alt="콘텐츠 이미지 미리보기" className="h-40 w-full object-cover" />
            <button
              type="button"
              onClick={clearImage}
              className="w-full py-sm font-label-sm text-label-sm text-on-surface-variant"
            >
              이미지 제거
            </button>
          </div>
        )}

        <div className="mb-lg grid grid-cols-3 gap-sm">
          {(['want', 'watching', 'done'] as ContentStatus[]).map((next) => (
            <button
              key={next}
              onClick={() => setStatus(next)}
              className={`min-h-[50px] rounded-xl px-sm py-sm font-label-sm text-label-sm transition-colors ${
                status === next ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
              }`}
            >
              {STATUS_INFO[next].text}
            </button>
          ))}
        </div>

        {status === 'done' && (
          <>
            <div className="mb-lg flex justify-center gap-md">
              {[1, 2, 3, 4, 5].map((score) => (
                <button key={score} onClick={() => setRating(score)} className="text-3xl transition-transform active:scale-110">
                  {score <= rating ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="감상"
              rows={3}
              className="mb-lg w-full resize-none rounded-xl bg-surface-container px-lg py-md font-body-md text-body-md text-on-surface outline-none placeholder-on-surface-variant/40"
            />
          </>
        )}

        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="w-full rounded-full bg-primary py-md font-label-md text-label-md text-on-primary transition-transform active:scale-95 disabled:opacity-40"
        >
          수정 완료
        </button>
      </div>
    </>
  )
}

// ── 메인 ────────────────────────────────────────────────────────────────────

export function ContentsScreen({ onNavigate }: ContentsScreenProps) {
  const { uid, coupleId } = useCoupleSession()
  const { myNickname, partnerNickname, myPhotoUrl, partnerPhotoUrl } = useApp()
  const { items, addContent, updateStatus, updateContent, deleteContent } = useContents(coupleId, uid)
  const { markTabRead } = useUnreadBadges()
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('전체')
  const [showAdd, setShowAdd] = useState(false)
  const [doneTarget, setDoneTarget] = useState<ContentItem | null>(null)
  const [editTarget, setEditTarget] = useState<ContentItem | null>(null)
  const [statusMenu, setStatusMenu] = useState<string | null>(null) // 상태 변경 메뉴 열린 id

  useEffect(() => {
    markTabRead('contents')
  }, [coupleId, uid, markTabRead])

  const myName = myNickname || '나'
  const partnerName = partnerNickname || '자기'

  const filtered = activeCategory === '전체'
    ? items
    : items.filter((i) => i.category === activeCategory)

  const handleStatusChange = (item: ContentItem, next: ContentStatus) => {
    setStatusMenu(null)
    if (next === 'done') {
      setDoneTarget(item)
    } else {
      updateStatus(item.id, next)
    }
  }

  return (
    <div className="screen bg-[#EEE9DC] text-on-surface min-h-screen">
      {/* Header */}
      <header className="bg-[#EEE9DC] w-full top-0 sticky z-40">
        <div className="flex justify-between items-center px-margin-mobile py-sm">
          <div className="flex items-center gap-md">
            <button
              onClick={() => onNavigate('home')}
              className="p-xs rounded-full hover:bg-surface-container transition-colors"
              style={{ color: 'var(--color-text)' }}
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="font-headline-md text-headline-md font-semibold text-primary">같이 볼 것들 🎬</h1>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-on-primary shadow-sm active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-sm overflow-x-auto py-sm px-margin-mobile hide-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-none px-lg py-xs rounded-full font-label-md text-label-md transition-all active:scale-95 ${
                activeCategory === cat
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/20'
              }`}
            >
              {cat === '전체' ? '전체' : CATEGORY_LABEL[cat as ContentCategory]}
            </button>
          ))}
        </div>
      </header>

      <main className="w-full px-margin-mobile pb-32 pt-md">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-xxl text-center gap-md">
            <span className="text-5xl">🎬</span>
            <p className="font-body-md text-body-md text-on-surface-variant">아직 항목이 없어요</p>
            <button
              onClick={() => setShowAdd(true)}
              className="px-xl py-sm bg-primary text-on-primary rounded-full font-label-md text-label-md active:scale-95 transition-transform"
            >
              추가하기
            </button>
          </div>
        ) : (
          <div style={{ columnCount: 2, columnGap: '12px' }}>
            {filtered.map((item) => {
              const addedByName = item.addedBy === uid ? myName : partnerName
              const addedByPhotoUrl = item.addedBy === uid ? myPhotoUrl : partnerPhotoUrl
              const statusInfo = STATUS_INFO[item.status]
              return (
                <div key={item.id} style={{ breakInside: 'avoid', marginBottom: '12px' }}>
                  <ContentActionSheet
                    enabled={item.addedBy === uid}
                    onEdit={() => setEditTarget(item)}
                    onDelete={() => deleteContent(item.id)}
                  >
                  <div className="bg-[#F5F2EB] rounded-xl shadow-sm p-md space-y-sm relative">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={`${item.title} 이미지`}
                        className="-mx-md -mt-md mb-sm h-36 w-[calc(100%+2rem)] rounded-t-xl object-cover"
                        loading="lazy"
                      />
                    )}
                    {/* 상태 배지 + 이모지 */}
                    <div className="flex justify-between items-start">
                      <span className={`text-[11px] px-sm py-[2px] rounded-full font-medium ${statusInfo.className}`}>
                        {statusInfo.text}
                      </span>
                      <span className="text-xl">{CATEGORY_EMOJI[item.category]}</span>
                    </div>

                    {/* 제목 */}
                    <h3 className="font-label-md text-label-md font-bold text-on-surface leading-snug">{item.title}</h3>

                    {/* 메모 */}
                    {item.memo && (
                      <p className="text-[12px] text-on-surface-variant leading-relaxed line-clamp-2">{item.memo}</p>
                    )}
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex min-h-[44px] items-center gap-xs rounded-full border border-primary/40 px-sm py-xs text-[11px] font-semibold text-primary"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        바로가기
                      </a>
                    )}

                    {/* 별점 (done) */}
                    {item.status === 'done' && item.rating && (
                      <p className="text-sm">{'⭐'.repeat(item.rating)}</p>
                    )}
                    {item.status === 'done' && item.review && (
                      <p className="text-[11px] text-on-surface-variant line-clamp-2 italic">"{item.review}"</p>
                    )}

                    {/* 추가한 사람 + 상태 변경 버튼 */}
                    <div className="flex items-center justify-between pt-xs border-t border-outline-variant/10">
                      <div className="flex items-center gap-xs">
                        <ProfileAvatar src={addedByPhotoUrl} name={addedByName} size="xs" />
                        <span className="text-[10px] text-on-surface-variant">{addedByName}</span>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setStatusMenu(statusMenu === item.id ? null : item.id)}
                          className="p-xs rounded-full hover:bg-surface-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-outline-variant text-sm">more_horiz</span>
                        </button>
                        {statusMenu === item.id && (
                          <div className="absolute right-0 bottom-8 bg-surface rounded-xl shadow-lg border border-outline-variant/20 overflow-hidden z-10 w-36">
                            {(['want', 'watching', 'done'] as ContentStatus[]).map((s) => (
                              <button
                                key={s}
                                onClick={() => handleStatusChange(item, s)}
                                className={`w-full px-md py-sm text-left font-label-sm text-label-sm hover:bg-surface-container transition-colors ${item.status === s ? 'text-primary font-semibold' : 'text-on-surface'}`}
                              >
                                {STATUS_INFO[s].text}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  </ContentActionSheet>
                </div>
              )
            })}
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-xxl text-center py-xl">
            <div className="inline-block px-xl py-xs bg-primary/5 rounded-full border border-primary/10">
              <p className="text-label-sm font-label-sm text-primary">
                위시리스트 {items.length}개 ✨
              </p>
            </div>
          </div>
        )}
      </main>

      {/* 추가 시트 */}
      {showAdd && <AddSheet onAdd={addContent} onClose={() => setShowAdd(false)} />}

      {/* 완료 처리 시트 */}
      {doneTarget && (
        <DoneSheet
          item={doneTarget}
          onSave={(rating, review) => updateStatus(doneTarget.id, 'done', { rating, review })}
          onClose={() => setDoneTarget(null)}
        />
      )}

      {editTarget && (
        <EditSheet
          item={editTarget}
          onSave={(data) => updateContent(editTarget.id, data)}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* 배경 탭으로 상태 메뉴 닫기 */}
      {statusMenu && (
        <div className="fixed inset-0 z-[5]" onClick={() => setStatusMenu(null)} />
      )}

      <BottomNav active="more" onNavigate={onNavigate} />

      <button
        type="button"
        onClick={() => setShowAdd(true)}
        className="app-fixed-fab fixed w-14 h-14 rounded-full bg-primary text-on-primary shadow-lg flex items-center justify-center active:scale-90 transition-transform z-40"
        style={{ bottom: 'var(--fab-bottom-offset)' }}
        aria-label="콘텐츠 추가"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>
    </div>
  )
}
