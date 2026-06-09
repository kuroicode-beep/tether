// src/screens/ReleaseLogScreen.tsx
// Shows release, update, and hotfix notes for the app.
import { SubScreen } from '../components/SubScreen'
import { ScreenHeader } from '../components/ScreenHeader'

interface ReleaseLogScreenProps {
  onBack: () => void
}

type LogType = 'release' | 'update' | 'hotfix'

interface ReleaseLogEntry {
  id: string
  date: string
  type: LogType
  title: string
  detail?: string
}

const TYPE_LABEL: Record<LogType, string> = {
  release: '릴리즈',
  update: '업데이트',
  hotfix: '핫픽스',
}

const TYPE_CLASS: Record<LogType, string> = {
  release: 'bg-primary text-on-primary',
  update: 'bg-secondary-container text-on-surface',
  hotfix: 'bg-error-container text-on-error-container',
}

const RELEASE_LOGS: ReleaseLogEntry[] = [
  {
    id: '2026-06-10-update-profile-photo-thumbnails',
    date: '2026.06.10',
    type: 'update',
    title: '프로필 사진 업로드 및 썸네일 표시 적용.',
    detail: '설정에서 프로필 사진을 업로드하고, 채팅 메시지와 일기/콘텐츠/사진첩 게시글 작성자 영역에 썸네일을 표시합니다.',
  },
  {
    id: '2026-06-10-release-rc-v0-1',
    date: '2026.06.10',
    type: 'release',
    title: 'Tether RC v0.1 완료.',
  },
  {
    id: '2026-06-10-update-history-status-timeline',
    date: '2026.06.10',
    type: 'update',
    title: '히스토리 메뉴 기능 의도대로 적용.',
    detail: '두 사람의 표정 아이콘, 태그, 상태 메시지를 시간 순으로 볼 수 있게 정리했습니다.',
  },
  {
    id: '2026-06-10-hotfix-home-status-usability',
    date: '2026.06.10',
    type: 'hotfix',
    title: '홈 사용성 및 상태 표시 핫픽스.',
    detail: '뒤로가기 동작, 닉네임 유지, 5단계 표정, 상태 태그, 최근 활동 표시를 보강했습니다.',
  },
  {
    id: '2026-06-10-hotfix-chat-image-album-status',
    date: '2026.06.10',
    type: 'hotfix',
    title: '채팅 이미지 표시 및 사진첩 보내기 핫픽스.',
    detail: '상대가 보낸 사진 표시, 채팅 사진의 사진첩 등록, 메시지 상태 표정 표시를 추가했습니다.',
  },
  {
    id: '2026-06-10-hotfix-high-contrast-photo-verify',
    date: '2026.06.10',
    type: 'hotfix',
    title: '고대비 상태 가독성 및 사진첩 검증 핫픽스.',
    detail: '고대비 테마의 상태 태그와 상태 메시지 대비를 보강하고, 사진첩 업로드 및 표시 검증을 강화했습니다.',
  },
]

export function ReleaseLogScreen({ onBack }: ReleaseLogScreenProps) {
  return (
    <SubScreen>
      <ScreenHeader title="Log" onBack={onBack} />

      <main className="sub-screen-body w-full px-margin-mobile py-lg pb-32">
        <section className="mb-lg rounded-xl bg-[#F5F2EB] p-md shadow-sm">
          <h2 className="font-label-md text-label-md font-semibold text-on-surface">업데이트 기록</h2>
          <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">
            릴리즈, 핫픽스, 기능 변경 기록을 날짜순으로 확인할 수 있어요.
          </p>
        </section>

        <div className="space-y-md">
          {RELEASE_LOGS.map((entry) => (
            <article key={entry.id} className="rounded-xl bg-surface-container p-md shadow-sm">
              <div className="mb-sm flex flex-wrap items-center gap-xs">
                <span className={`rounded-full px-sm py-xs font-label-sm text-label-sm ${TYPE_CLASS[entry.type]}`}>
                  {TYPE_LABEL[entry.type]}
                </span>
                <time className="font-label-sm text-label-sm text-on-surface-variant">{entry.date}</time>
              </div>
              <h3 className="font-label-md text-label-md font-semibold text-on-surface">{entry.title}</h3>
              {entry.detail && (
                <p className="mt-xs font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
                  {entry.detail}
                </p>
              )}
            </article>
          ))}
        </div>
      </main>
    </SubScreen>
  )
}
