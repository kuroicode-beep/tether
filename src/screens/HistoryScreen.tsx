import { useState, useRef } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useHistory, HistoryItem } from '../hooks/useHistory'
import { useCoupleSession } from '../hooks/useCoupleSession'
import { ImageViewer } from '../components/ImageViewer'
import { ContentActionSheet } from '../components/ContentActionSheet'
import { SubScreen } from '../components/SubScreen'
import { ScreenHeader } from '../components/ScreenHeader'

interface HistoryScreenProps {
  onBack: () => void
}

interface HistoryFormSheetProps {
  initial?: HistoryItem
  onSave: (data: { title: string; memo?: string; date: Date; imageFile?: File }) => void
  onClose: () => void
}

// 기억 추가/수정 바텀시트
function HistoryFormSheet({ initial, onSave, onClose }: HistoryFormSheetProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [date, setDate] = useState(() =>
    initial
      ? new Date(initial.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
  )
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(initial?.imageUrl ?? null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      memo: memo.trim() || undefined,
      date: new Date(date),
      imageFile: imageFile ?? undefined,
    })
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="app-fixed-x fixed bottom-0 z-50 bg-surface rounded-t-3xl px-margin-mobile pt-lg pb-xxl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />
        <h2 className="font-label-md text-label-md font-semibold text-on-surface mb-lg">
          {initial ? '기억 수정' : '기억 추가'}
        </h2>

        <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs">날짜</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-surface-container rounded-xl px-lg py-md font-body-md text-body-md text-on-surface outline-none mb-sm"
        />

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="무슨 날이었나요?"
          autoFocus
          className="w-full bg-surface-container rounded-xl px-lg py-md font-body-md text-body-md text-on-surface placeholder-on-surface-variant/40 outline-none mb-sm"
        />

        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          rows={3}
          className="w-full bg-surface-container rounded-xl px-lg py-md font-body-md text-body-md text-on-surface placeholder-on-surface-variant/40 outline-none resize-none mb-sm"
        />

        {preview ? (
          <div className="relative mb-sm">
            <img src={preview} alt="미리보기" className="w-full rounded-xl max-h-40 object-cover" />
            <button
              onClick={() => { setImageFile(null); setPreview(null) }}
              className="absolute top-sm right-sm w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-white text-sm">close</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-sm text-secondary font-label-md text-label-md mb-lg"
          >
            <span className="material-symbols-outlined">add_photo_alternate</span>
            사진 첨부
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="w-full bg-primary text-on-primary rounded-full py-md font-label-md text-label-md disabled:opacity-40 active:scale-95 transition-transform"
        >
          저장
        </button>
      </div>
    </>
  )
}

export function HistoryScreen({ onBack }: HistoryScreenProps) {
  const { uid, coupleId, partnerUid, isLoading: sessionLoading } = useCoupleSession()
  const { items, loading, error, addHistory, updateHistory, deleteHistory, clearError } = useHistory(
    coupleId,
    uid,
    partnerUid,
  )
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<HistoryItem | null>(null)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)

  const isOwnItem = (item: HistoryItem) => Boolean(uid && item.authorUid === uid)

  return (
    <SubScreen>
      <ScreenHeader title="우리의 기록 📖" onBack={onBack} />

      {error && (
        <div className="mx-margin-mobile mt-sm px-md py-sm rounded-xl bg-error-container text-on-error-container flex items-center justify-between gap-sm">
          <p className="font-body-sm text-body-sm flex-1">{error}</p>
          <button type="button" onClick={clearError} className="shrink-0 opacity-70" aria-label="닫기">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      <main className="sub-screen-body w-full px-margin-mobile py-lg pb-32">
        {(sessionLoading || loading) && items.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-xxl gap-md min-h-[60vh]">
            <span className="material-symbols-outlined text-outline-variant animate-spin text-2xl">
              progress_activity
            </span>
            <p className="font-body-md text-body-md text-on-surface-variant">기록을 불러오는 중...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-xxl text-center gap-md min-h-[60vh]">
            <span className="material-symbols-outlined text-[56px] text-primary/30" style={{ fontVariationSettings: "'FILL' 1" }}>
              history
            </span>
            <p className="font-body-md text-body-md text-on-surface-variant">특별한 순간을 기록해보세요 ✨</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-[2px] bg-primary/20 rounded-full" />

            <div className="space-y-lg">
              {items.map((item) => (
                <div key={item.id} className="flex gap-md">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary-container border-2 border-primary flex items-center justify-center z-10">
                      <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                        favorite
                      </span>
                    </div>
                  </div>

                  <ContentActionSheet
                    enabled={isOwnItem(item)}
                    onEdit={() => setEditing(item)}
                    onDelete={() => deleteHistory(item.id)}
                  >
                    <div className="flex-1 bg-[#F5F2EB] rounded-xl p-md shadow-sm pb-md">
                      <p className="font-label-sm text-label-sm text-primary mb-xs">
                        {format(new Date(item.date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                      </p>
                      <h3 className="font-label-md text-label-md font-semibold text-on-surface mb-xs">{item.title}</h3>
                      {item.memo && (
                        <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed text-sm mb-sm">
                          {item.memo}
                        </p>
                      )}
                      {item.imageUrl && (
                        <button
                          onClick={() => setViewerUrl(item.imageUrl!)}
                          className="w-full active:scale-95 transition-transform"
                        >
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full rounded-lg object-cover max-h-48"
                            loading="lazy"
                          />
                        </button>
                      )}
                    </div>
                  </ContentActionSheet>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <button
        onClick={() => setShowAdd(true)}
        className="app-fixed-fab fixed w-14 h-14 rounded-full bg-primary text-on-primary shadow-lg flex items-center justify-center active:scale-90 transition-transform"
        style={{ bottom: 'var(--fab-bottom-offset)' }}
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

      {showAdd && (
        <HistoryFormSheet
          onSave={addHistory}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editing && (
        <HistoryFormSheet
          initial={editing}
          onSave={(data) => updateHistory(editing.id, data)}
          onClose={() => setEditing(null)}
        />
      )}
      {viewerUrl && <ImageViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />}
    </SubScreen>
  )
}
