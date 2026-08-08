// src/components/RelayNovelBanner.tsx
// 채팅 상단에 릴레이소설 진행 상태와 "누구 차례인지"를 알리는 띠.
// 일반 채팅과 구분되도록 강조 배경을 쓰고, 차례는 색이 아닌 글자로 표시한다.
// 오른쪽 [중지] 버튼으로 일시중지하면 띠가 숨고 서재에서 재개할 수 있다.
import type { RelayNovel } from '../lib/relayNovel'

interface RelayNovelBannerProps {
  novel: RelayNovel
  assisting: boolean
  turnOwnerName: string
  isMyTurn: boolean
  onOpenInfo: () => void
  onPause: () => void
}

export function RelayNovelBanner({
  novel, assisting, turnOwnerName, isMyTurn, onOpenInfo, onPause,
}: RelayNovelBannerProps) {
  const stateLabel = assisting ? '이어쓰는 중' : '쓰는 중'
  const noteCount = novel.background.length

  return (
    <div className="relay-banner-row">
      <button
        type="button"
        className="relay-banner"
        onClick={onOpenInfo}
        aria-label={`릴레이소설 ${novel.title}, 설정 ${noteCount}개, 열어보기`}
      >
        <span className="material-symbols-outlined relay-banner-icon" aria-hidden="true">
          history_edu
        </span>
        <div className="relay-banner-body">
          <p className="relay-banner-title">{novel.title}</p>
          <p className="relay-banner-meta">
            릴레이소설 · {novel.turnCount}턴 · {stateLabel}
            {noteCount > 0 && ` · 설정 ${noteCount}`}
          </p>
        </div>
        <span className={`relay-turn-badge${isMyTurn ? ' relay-turn-badge--mine' : ''}`}>
          {isMyTurn ? '내 차례' : `${turnOwnerName} 차례`}
        </span>
        {assisting ? (
          <span className="material-symbols-outlined relay-banner-spinner" aria-hidden="true">
            progress_activity
          </span>
        ) : (
          <span className="material-symbols-outlined relay-banner-more" aria-hidden="true">
            chevron_right
          </span>
        )}
      </button>
      <button
        type="button"
        className="relay-banner-pause"
        onClick={onPause}
        aria-label="릴레이소설 일시중지 — 상단에서 숨기고 서재에서 재개"
      >
        <span className="material-symbols-outlined" aria-hidden="true">pause_circle</span>
        <span className="relay-banner-pause-label">중지</span>
      </button>
    </div>
  )
}
