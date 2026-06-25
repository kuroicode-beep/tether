// src/screens/ListenTogetherScreen.tsx
// Couple playlist builder from library audio files.
import { BottomNav } from '../components/BottomNav'
import { ScreenHeader } from '../components/ScreenHeader'
import { SubScreen } from '../components/SubScreen'
import { useApp } from '../context/AppContext'
import { useCoupleSession } from '../hooks/useCoupleSession'
import { useLibrary } from '../hooks/useLibrary'
import { ListenTrack, useListeningTogether } from '../hooks/useListeningTogether'

interface ListenTogetherScreenProps {
  onBack: () => void
  onNavigate: (screen: 'home' | 'chat' | 'diary' | 'more') => void
  onShowPlayer: () => void
}

function isAudioFile(fileName: string, fileType: string): boolean {
  return fileType.startsWith('audio/') || /\.(mp3|m4a|wav|aac|ogg|flac)$/i.test(fileName)
}

export function ListenTogetherScreen({ onBack, onNavigate, onShowPlayer }: ListenTogetherScreenProps) {
  const { uid, coupleId } = useCoupleSession()
  const { myNickname, partnerNickname, partnerUid } = useApp()
  const { files } = useLibrary(coupleId, uid)
  const {
    myTracks,
    partnerTracks,
    activeTracks,
    excludedBy,
    setMyTrackSelected,
    setExcludedPartnerTrack,
  } = useListeningTogether(coupleId, uid, partnerUid)

  const myName = myNickname || '나'
  const partnerName = partnerNickname || '자기'
  const audioFiles = files.filter((item) => isAudioFile(item.fileName, item.fileType))
  const mySelectedIds = new Set(myTracks.map((track) => track.id))
  const excludedPartnerTrackId = uid ? excludedBy[uid] : null

  const toTrack = (item: typeof audioFiles[number]): ListenTrack => ({
    id: item.id,
    title: item.fileName,
    url: item.fileUrl,
    ownerUid: uid ?? '',
  })

  const toggleMyTrack = async (item: typeof audioFiles[number]) => {
    if (!uid) return
    const selected = mySelectedIds.has(item.id)
    await setMyTrackSelected(toTrack(item), !selected)
  }

  return (
    <SubScreen>
      <ScreenHeader
        title="같이듣기"
        onBack={onBack}
        right={(
          <button
            type="button"
            onClick={onShowPlayer}
            className="min-h-[44px] rounded-full border border-primary px-md font-label-sm text-label-sm text-primary"
          >
            Player
          </button>
        )}
      />

      <main className="sub-screen-body space-y-md px-margin-mobile pb-32 pt-sm">
        <section className="hc-readable-box rounded-xl bg-surface p-md">
          <p className="font-label-md text-label-md font-semibold text-on-surface">플레이리스트</p>
          <p className="mt-xs font-label-sm text-label-sm text-on-surface-variant">
            각자 3곡씩 고르고, 내 화면에서는 상대 곡 중 1곡만 제외할 수 있어요. 현재 재생 후보 {activeTracks.length}곡.
          </p>
        </section>

        <section className="hc-readable-box rounded-xl bg-surface p-md">
          <h2 className="mb-sm font-label-md text-label-md font-semibold text-on-surface">{myName}의 3곡</h2>
          <p className="mb-sm font-label-sm text-label-sm text-on-surface-variant">{myTracks.length}/3 선택됨</p>
          <div className="space-y-sm">
            {audioFiles.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">자료실에 음악 파일이 없어요.</p>
            ) : audioFiles.map((item) => {
              const selected = mySelectedIds.has(item.id)
              const disabled = !selected && myTracks.length >= 3
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void toggleMyTrack(item)}
                  disabled={disabled}
                  className={`listen-track-row ${selected ? 'listen-track-row--active' : ''}`}
                  aria-pressed={selected}
                >
                  <span className="material-symbols-outlined text-primary">{selected ? 'check_circle' : 'radio_button_unchecked'}</span>
                  <span className="min-w-0 flex-1 truncate text-left">{item.fileName}</span>
                  <span className="text-[11px] opacity-70">{item.senderUid === uid ? myName : partnerName}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="hc-readable-box rounded-xl bg-surface p-md">
          <h2 className="mb-sm font-label-md text-label-md font-semibold text-on-surface">{partnerName}의 곡</h2>
          <p className="mb-sm font-label-sm text-label-sm text-on-surface-variant">상대 곡은 수정할 수 없고, 한 곡만 내 재생에서 제외할 수 있어요.</p>
          <div className="space-y-sm">
            {partnerTracks.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">상대가 아직 곡을 고르지 않았어요.</p>
            ) : partnerTracks.map((track) => {
              const excluded = excludedPartnerTrackId === track.id
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => void setExcludedPartnerTrack(excluded ? null : track.id)}
                  className={`listen-track-row ${excluded ? 'listen-track-row--excluded' : ''}`}
                  aria-pressed={excluded}
                >
                  <span className="material-symbols-outlined text-primary">{excluded ? 'remove_circle' : 'music_note'}</span>
                  <span className="min-w-0 flex-1 truncate text-left">{track.title}</span>
                  <span className="text-[11px] opacity-70">{excluded ? '제외됨' : '포함'}</span>
                </button>
              )
            })}
          </div>
        </section>
      </main>

      <BottomNav active="more" onNavigate={onNavigate} />
    </SubScreen>
  )
}
