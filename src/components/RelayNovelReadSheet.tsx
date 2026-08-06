// src/components/RelayNovelReadSheet.tsx
// 지금까지 쓴 릴레이소설 본문을 이어서 읽는 시트 (/릴소 보기).
// 채팅에는 턴이 대화 사이에 흩어져 있어, 여기서는 소설처럼 이어 붙여 보여준다.
import { buildNovelDocument, type RelayNovel } from '../lib/relayNovel'

interface RelayNovelReadSheetProps {
  novel: RelayNovel
  onClose: () => void
}

export function RelayNovelReadSheet({ novel, onClose }: RelayNovelReadSheetProps) {
  // 진행 중인 이야기도 문서로 내려받을 수 있게 한다
  const handleDownload = () => {
    const blob = new Blob([buildNovelDocument(novel)], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const now = new Date()
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    link.href = url
    link.download = `릴레이소설_${date}_${novel.title.replace(/\s+/g, '_')}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="attachment-sheet relay-read-sheet z-50 bg-surface rounded-t-3xl px-margin-mobile pt-lg pb-xxl shadow-2xl">
        <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-lg" />

        <p className="relay-sheet-title">{novel.title}</p>
        <p className="relay-sheet-hint mb-lg">
          {novel.turnCount}턴까지 썼어요
          {novel.background.length > 0 && ` · 설정 ${novel.background.length}개`}
        </p>

        {novel.turns.length === 0 ? (
          <p className="relay-sheet-empty">
            아직 쓴 내용이 없어요. /릴소 쓰기 로 첫 문장을 시작해보세요.
          </p>
        ) : (
          <div className="relay-read-body">
            {novel.turns.map((turn, index) => (
              <article key={`${turn.at}-${index}`} className="relay-read-turn">
                <div className="relay-turn-head">
                  <span className="relay-turn-number">{index + 1}</span>
                  <span className="relay-turn-author">{turn.authorName}</span>
                  {turn.bySidekick && <span className="relay-turn-tag">이어쓰기 도움</span>}
                </div>
                <p className="relay-turn-text">{turn.text}</p>
              </article>
            ))}
          </div>
        )}

        {novel.turns.length > 0 && (
          <button type="button" onClick={handleDownload} className="btn-outline w-full mt-lg">
            문서 파일로 저장
          </button>
        )}
        <button type="button" onClick={onClose} className="btn-outline w-full mt-sm">
          닫기
        </button>
      </div>
    </>
  )
}
