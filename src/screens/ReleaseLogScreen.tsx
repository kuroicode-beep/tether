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
    id: '2026-06-12-hotfix-disconnect-couple',
    date: '2026.06.12',
    type: 'hotfix',
    title: '커플 연결 해제가 실제 계정 상태에 반영되도록 수정.',
    detail: '설정의 연결 해제가 로컬 캐시만 비우지 않고 Cloud Function을 통해 양쪽 users.coupleId를 해제하도록 보강했습니다.',
  },
  {
    id: '2026-06-12-hotfix-google-recovery-onboarding',
    date: '2026.06.12',
    type: 'hotfix',
    title: 'iOS 재설치 후 Google 로그인 복구 안내 흐름 추가.',
    detail: 'Google 로그인 후 커플 정보가 없을 때 바로 코드 입력으로 보내지 않고, 기존 연결 재확인/다른 Google 계정 로그인/새 연결 진행을 분리한 복구 안내 화면을 표시합니다.',
  },
  {
    id: '2026-06-12-hotfix-high-contrast-status-message-black',
    date: '2026.06.12',
    type: 'hotfix',
    title: '고대비 상태 메시지 박스 색상 수정.',
    detail: '상태 메시지를 검은 배경, 흰 글씨, 흰 보더, 둥근 모서리 박스로 다시 맞췄습니다.',
  },
  {
    id: '2026-06-12-hotfix-high-contrast-white-status-cards',
    date: '2026.06.12',
    type: 'hotfix',
    title: '고대비 상태 카드를 흰색 둥근 박스 중심으로 재정리.',
    detail: '상태 메시지와 태그를 흰색 둥근 박스+검정 글자로 단순화하고, 편집 선택 항목만 노란색으로 강조되게 정리했습니다.',
  },
  {
    id: '2026-06-12-hotfix-high-contrast-status-cleanup',
    date: '2026.06.12',
    type: 'hotfix',
    title: '고대비 상태 카드 편집 화면 색상 정리.',
    detail: '상태 카드 편집 모드의 회색 패널, 과한 흰 테두리, 칩 대비를 정리해 선택 항목만 노란색으로 명확하게 보이도록 보강했습니다.',
  },
  {
    id: '2026-06-12-update-font-settings-release-log',
    date: '2026.06.12',
    type: 'update',
    title: '폰트 크기·폰트 선택 설정과 Log 기록 정책을 추가.',
    detail: '설정에서 소/중/대 폰트 크기와 기본, 카페24동동체, 메이플스토리체, 나눔고딕 등 앱 폰트를 선택할 수 있게 했고, 앞으로 모든 수정사항을 Log 페이지에 남기도록 정리했습니다.',
  },
  {
    id: '2026-06-12-hotfix-status-high-contrast-notification',
    date: '2026.06.12',
    type: 'hotfix',
    title: '상태 카드 고대비·편집모드와 Android 알림 체감 보강.',
    detail: '상대방 상태를 위로 올리고, 내 상태는 편집 버튼을 눌렀을 때만 수정되도록 바꿨습니다. 고대비 상태 카드 색상을 정리하고 Android 알림 tag/vibration 옵션도 보강했습니다.',
  },
  {
    id: '2026-06-12-update-mobile-chat-status-diary-contents',
    date: '2026.06.12',
    type: 'update',
    title: '모바일 채팅, 상태, 교환일기, 콘텐츠 편집 UX 개선.',
    detail: '큰 종소리 알림음, iOS 채팅 스크롤 튐 완화, 채팅 상태 이모티콘 제거, 교환일기/콘텐츠 전체 수정, 상태 태그 추가, powered by 디또 문구를 반영했습니다.',
  },
  {
    id: '2026-06-11-hotfix-mobile-notification-silent',
    date: '2026.06.11',
    type: 'hotfix',
    title: '모바일 백그라운드 알림 무음 체감 핫픽스.',
    detail: 'Service Worker 백그라운드 알림을 non-silent로 고정해 Android PWA 알림이 조용한 알림처럼 내려가는 문제를 줄였습니다.',
  },
  {
    id: '2026-06-11-hotfix-notification-multidevice',
    date: '2026.06.11',
    type: 'hotfix',
    title: '기기별 Web Push 토큰 저장 및 멀티 디바이스 발송.',
    detail: 'PC와 스마트폰 토큰이 서로 덮어쓰지 않도록 기기별 FCM 토큰을 저장하고, Functions에서 모든 등록 기기에 알림을 발송하게 했습니다.',
  },
  {
    id: '2026-06-11-hotfix-chat-autoscroll',
    date: '2026.06.11',
    type: 'hotfix',
    title: '채팅 진입·전송·수신 자동 스크롤 핫픽스.',
    detail: '채팅 첫 진입, 메시지 전송, 상대 메시지 수신 시 마지막 대화가 보이도록 스크롤 기준을 마지막 메시지 ID 중심으로 보강했습니다.',
  },
  {
    id: '2026-06-09-release-stabilization-steps',
    date: '2026.06.09',
    type: 'release',
    title: 'Tether 안정화 Steps 2-6 자동 검증 및 배포 완료.',
    detail: '읽음 배지, Firestore/Storage ownership, optimistic sync, PWA 알림/접근성, 최종 E2E 검증과 Firebase Hosting 배포를 완료했습니다.',
  },
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
