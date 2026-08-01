// src/components/RelayNovelInfoSheet.tsx
// 상단 띠를 눌렀을 때 열리는 설정 시트.
// 제목과 배경·장르·인물 설정을 보고, 설정은 여기서 바로 지울 수 있다.
import type { RelayNovel } from '../lib/relayNovel'

interface RelayNovelInfoSheetProps {
  novel: RelayNovel
  turnOwnerName: string
  isMyTurn: boolean
  onRemoveBackground: (noteId: string) => void
  onClose: () => void
}

export function RelayNovelInfoSheet({
  novel, turnOwnerName, isMyTurn, onRemoveBackground, onClose,
}: RelayNovelInfoSheetProps) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="attachment-sheet z-50 bg-surface rounded-t-3xl px-margin-mobile pt-lg pb-xxl shadow-2xl">
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />

        <p className="relay-sheet-label">제목</p>
        <p className="relay-sheet-title">{novel.title}</p>
        <p className="relay-sheet-hint">
          /릴레이소설 제목 새제목 — 둘 다 언제든 바꿀 수 있어요
        </p>

        <p className="relay-sheet-label mt-lg">
          지금 차례 — {isMyTurn ? '나' : turnOwnerName}
        </p>

        <p className="relay-sheet-label mt-lg">
          설정 {novel.background.length > 0 && `(${novel.background.length})`}
        </p>

        {novel.background.length === 0 ? (
          <p className="relay-sheet-empty">
            아직 설정이 없어요. /릴레이소설 배경 내용 으로 장르·배경·인물을 더해보세요.
          </p>
        ) : (
          <ul className="relay-sheet-list">
            {novel.background.map((note, index) => (
              <li key={note.id} className="relay-sheet-item">
                <span className="relay-sheet-index">{index + 1}</span>
                <div className="relay-sheet-item-body">
                  <p className="relay-sheet-item-text">{note.text}</p>
                  <p className="relay-sheet-item-by">{note.byName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveBackground(note.id)}
                  className="relay-sheet-remove"
                  aria-label={`${index + 1}번 설정 지우기`}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="relay-sheet-hint mt-md">
          이 설정은 /릴레이소설 도움 을 쓸 때 함께 전달돼요.
        </p>

        <button type="button" onClick={onClose} className="btn-outline w-full mt-lg">
          닫기
        </button>
      </div>
    </>
  )
}
