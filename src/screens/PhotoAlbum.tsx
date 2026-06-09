import { useState, useRef } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { usePhotos, Photo } from '../hooks/usePhotos'
import { useApp } from '../context/AppContext'
import { useCoupleSession } from '../hooks/useCoupleSession'
import { ImageViewer } from '../components/ImageViewer'
import { SubScreen } from '../components/SubScreen'
import { ScreenHeader } from '../components/ScreenHeader'

interface PhotoAlbumProps {
  onBack: () => void
}

interface UploadSheetProps {
  preview: string
  onSave: (caption: string) => void
  onCancel: () => void
}

function UploadSheet({ preview, onSave, onCancel }: UploadSheetProps) {
  const [caption, setCaption] = useState('')
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onCancel} />
      <div className="app-fixed-x fixed bottom-0 z-50 bg-surface rounded-t-3xl px-margin-mobile pt-lg pb-xxl shadow-2xl">
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />
        <div className="flex justify-center mb-md">
          <img src={preview} alt="업로드 미리보기" className="max-h-48 rounded-xl object-contain" />
        </div>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="캡션 입력 (선택)"
          autoFocus
          className="w-full bg-surface-container rounded-xl px-lg py-md font-body-md text-body-md text-on-surface placeholder-on-surface-variant/40 outline-none mb-lg"
        />
        <div className="space-y-sm">
          <button
            onClick={() => { onSave(caption.trim()); }}
            className="w-full bg-primary text-on-primary rounded-full py-md font-label-md text-label-md active:scale-95 transition-transform"
          >
            저장
          </button>
          <button onClick={onCancel} className="w-full py-md font-label-md text-label-md text-on-surface-variant">
            취소
          </button>
        </div>
      </div>
    </>
  )
}

interface DetailViewProps {
  photo: Photo
  myUid: string
  myNickname: string
  partnerNickname: string
  onClose: () => void
  onZoom: () => void
}

function DetailView({ photo, myUid, myNickname, partnerNickname, onClose, onZoom, onEdit, onDelete }: DetailViewProps & {
  onEdit?: () => void
  onDelete?: () => void
}) {
  const uploaderName = photo.uploadedBy === myUid ? myNickname : partnerNickname
  const isMe = photo.uploadedBy === myUid
  const dateStr = photo.createdAt
    ? format(new Date(photo.createdAt), 'yyyy년 M월 d일 (EEE)', { locale: ko })
    : ''

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex flex-col pointer-events-none">
        {/* 이미지 영역 */}
        <div className="flex-1 flex items-center justify-center pointer-events-auto" onClick={onClose}>
          <img
            src={photo.imageUrl}
            alt={photo.caption ?? '사진'}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => { e.stopPropagation(); onZoom() }}
          />
        </div>
        {/* 정보 */}
        <div className="pointer-events-auto bg-black/70 backdrop-blur-sm px-margin-mobile py-lg text-white">
          {photo.caption && (
            <p className="font-body-md text-body-md mb-xs">{photo.caption}</p>
          )}
          <div className="flex items-center justify-between gap-sm">
            <p className="font-label-sm text-label-sm opacity-70">{uploaderName} · {dateStr}</p>
            {isMe && (
              <div className="flex gap-sm">
                {onEdit && (
                  <button onClick={onEdit} className="px-sm py-xs rounded-full bg-white/20 font-label-sm text-label-sm">
                    수정
                  </button>
                )}
                {onDelete && (
                  <button onClick={onDelete} className="px-sm py-xs rounded-full bg-red-500/40 font-label-sm text-label-sm">
                    삭제
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export function PhotoAlbum({ onBack }: PhotoAlbumProps) {
  const { uid, coupleId, partnerUid, isLoading: sessionLoading } = useCoupleSession()
  const { myNickname, partnerNickname } = useApp()
  const { photos, loading, uploading, error, uploadPhoto, updatePhoto, deletePhoto, clearError } = usePhotos(
    coupleId,
    uid,
    partnerUid,
  )
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const myName = myNickname || '나'
  const partnerName = partnerNickname || '자기'

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setPendingFile(f)
    setPendingPreview(URL.createObjectURL(f))
    e.target.value = ''
  }

  const handleSave = async (caption: string) => {
    if (!pendingFile) return
    setPendingPreview(null)
    setPendingFile(null)
    await uploadPhoto(pendingFile, caption || undefined)
  }

  const handleCancel = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingFile(null)
    setPendingPreview(null)
  }

  return (
    <SubScreen>
      <ScreenHeader
        title="사진첩 📷"
        onBack={onBack}
        right={uploading ? (
          <span className="material-symbols-outlined text-outline-variant animate-spin text-sm w-11 flex justify-center">
            progress_activity
          </span>
        ) : undefined}
      />

      {error && (
        <div className="mx-margin-mobile mt-sm px-md py-sm rounded-xl bg-error-container text-on-error-container flex items-center justify-between gap-sm">
          <p className="font-body-sm text-body-sm flex-1">{error}</p>
          <button type="button" onClick={clearError} className="shrink-0 opacity-70" aria-label="닫기">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      <main className="sub-screen-body p-sm pb-32">
        {(sessionLoading || loading) && photos.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-xxl gap-md min-h-[60vh]">
            <span className="material-symbols-outlined text-outline-variant animate-spin text-2xl">
              progress_activity
            </span>
            <p className="font-body-md text-body-md text-on-surface-variant">사진을 불러오는 중...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-xxl text-center gap-md min-h-[60vh]">
            <span className="material-symbols-outlined text-[56px] text-primary/30" style={{ fontVariationSettings: "'FILL' 1" }}>
              photo_library
            </span>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {error ? '사진을 표시할 수 없어요' : '함께한 순간을 담아보세요 📸'}
            </p>
            {!error && (
              <p className="font-label-sm text-label-sm text-on-surface-variant/70 px-lg">
                상대가 올린 사진도 여기에 함께 보여요
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-[2px]">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="aspect-square overflow-hidden bg-surface-container active:opacity-80 transition-opacity"
              >
                <img
                  src={photo.imageUrl}
                  alt={photo.caption ?? ''}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </main>

      {/* FAB 업로드 버튼 */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="app-fixed-fab fixed w-14 h-14 rounded-full bg-primary text-on-primary shadow-lg flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
        style={{ bottom: 'var(--fab-bottom-offset)' }}
      >
        <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* 업로드 시트 */}
      {pendingPreview && (
        <UploadSheet preview={pendingPreview} onSave={handleSave} onCancel={handleCancel} />
      )}

      {/* 사진 상세 */}
      {selectedPhoto && !viewerUrl && (
        <DetailView
          photo={selectedPhoto}
          myUid={uid ?? ''}
          myNickname={myName}
          partnerNickname={partnerName}
          onClose={() => setSelectedPhoto(null)}
          onZoom={() => setViewerUrl(selectedPhoto.imageUrl)}
          onEdit={() => {
            const caption = window.prompt('캡션 수정', selectedPhoto.caption ?? '') ?? selectedPhoto.caption
            updatePhoto(selectedPhoto.id, caption?.trim() || null)
            setSelectedPhoto({ ...selectedPhoto, caption: caption?.trim() || null })
          }}
          onDelete={() => {
            if (!window.confirm('사진을 삭제할까요?')) return
            deletePhoto(selectedPhoto.id)
            setSelectedPhoto(null)
          }}
        />
      )}

      {/* 전체화면 뷰어 */}
      {viewerUrl && (
        <ImageViewer url={viewerUrl} onClose={() => { setViewerUrl(null); setSelectedPhoto(null) }} />
      )}
    </SubScreen>
  )
}
