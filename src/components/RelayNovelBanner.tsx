// src/components/RelayNovelBanner.tsx
// 채팅 상단에 릴레이소설 진행 상태와 "누구 차례인지"를 알리는 띠.
// 일반 채팅과 구분되도록 강조 배경을 쓰고, 차례는 색이 아닌 글자로 표시한다.
import type { RelayNovel } from '../lib/relayNovel'

interface RelayNovelBannerProps {
  novel: RelayNovel
  assisting: boolean
  turnOwnerName: string
  isMyTurn: boolean
}

export function RelayNovelBanner({
  novel, assisting, turnOwnerName, isMyTurn,
}: RelayNovelBannerProps) {
  const paused = novel.status === 'paused'
  const stateLabel = assisting ? '이어쓰는 중' : paused ? '잠시 멈춤' : '쓰는 중'

  return (
    <div className="relay-banner" role="status" aria-live="polite">
      <span className="material-symbols-outlined relay-banner-icon" aria-hidden="true">
        history_edu
      </span>
      <div className="relay-banner-body">
        <p className="relay-banner-title">{novel.title}</p>
        <p className="relay-banner-meta">
          릴레이소설 · {novel.turnCount}턴 · {stateLabel}
        </p>
      </div>
      <span className={`relay-turn-badge${isMyTurn ? ' relay-turn-badge--mine' : ''}`}>
        {isMyTurn ? '내 차례' : `${turnOwnerName} 차례`}
      </span>
      {assisting && (
        <span className="material-symbols-outlined relay-banner-spinner" aria-hidden="true">
          progress_activity
        </span>
      )}
    </div>
  )
}
