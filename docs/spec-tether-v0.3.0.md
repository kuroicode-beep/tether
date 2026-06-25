# Tether v0.3.0 상세 스펙

작성일: 2026-06-25
버전: `0.3.0` (`src/lib/appVersion.ts`)

## 01. 릴리즈 목표

Tether v0.3.0은 v0.2.0의 접근성·알림 안정화 기반 위에 다음 남은 개선사항을 묶은 업데이트다.

- Log 하단 기능개선/버그 리포트 커플 실시간 동기화
- 커플 공유 리포트 Firestore rules 및 E2E 검증 항목
- Log 리포트 표시 상태와 고대비 가독성 개선
- MoodChip, 채팅 메시지, Toast, 액션 시트 접근성 보강
- Firestore Web 오프라인 캐시 기반 적용

## 02. Log 리포트 동기화

### Firestore 경로

```text
couples/{coupleId}/feedbackReports/{reportId}
```

### 데이터 모델

```ts
type FeedbackReportType = 'improvement' | 'bug'
type FeedbackReportStatus = 'open' | 'done'

type FeedbackReport = {
  id: string
  clientId?: string
  type: FeedbackReportType
  text: string
  status: FeedbackReportStatus
  authorUid: string
  authorNickname: string
  createdAt: number | null
  updatedAt?: number | null
  doneAt?: number | null
  doneBy?: string | null
  pending?: boolean
}
```

### 동작

- 같은 couple 멤버가 작성한 리포트는 실시간으로 표시된다.
- 작성자는 삭제할 수 있다.
- 커플 멤버는 리포트 상태를 `open` / `done`으로 바꿀 수 있다.
- 기존 `tether_release_log_feedback_memos` localStorage 데이터는 1회 Firestore로 마이그레이션한다.
- 마이그레이션 성공 시 `tether_release_log_feedback_memos_backup_v030`에 백업한다.
- 마이그레이션 실패 시 기존 localStorage 원본을 삭제하지 않는다.

## 03. Firestore Rules

`feedbackReports` 권한 기준:

- read: 커플 멤버만
- create: 커플 멤버만, `authorUid == request.auth.uid`
- update: 커플 멤버만, `status`, `updatedAt`, `doneAt`, `doneBy`만 변경 가능
- delete: 작성자만

## 04. 표시 및 접근성

### Log 리포트 표시

- loading: `리포트를 불러오는 중...`
- empty: `아직 남긴 리포트가 없어요.`
- error: Firestore listener/write 실패 문구
- saving: `저장 중...`
- pending: `동기화 중`
- type chip: 기능개선 / 버그
- status chip: 열림 / 완료

### 고대비

새 리포트 영역에는 `hc-readable-box` 패턴을 적용한다.

- 검은 배경
- 흰 글씨
- 2px 흰 보더
- 둥근 모서리
- 버튼 최소 터치 타겟 50px

### 스크린 리더

- `MoodChip`: 기분 태그와 선택 상태를 `aria-label`로 제공
- `MessageBubble`: 보낸 사람, 시간, 내용/사진 여부를 `aria-label`로 제공
- `ToastNotification`: `role="status"`, `aria-live="polite"` 적용
- `ContentActionSheet`: `role="dialog"`, `aria-modal`, Escape 닫기, 첫 버튼 focus 적용

## 05. 오프라인 캐시

Firestore Web SDK 초기화는 persistent local cache를 우선 사용한다.

```ts
initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})
```

초기화 실패 시 기존 `getFirestore(app)`로 fallback한다.

## 06. 검증

자동 검증:

```bash
npm run build
firebase deploy --only firestore:rules --dry-run
```

보류 검증:

```bash
npx tsx scripts/test-e2e-firebase.ts
```

보류 이유:

- live E2E는 실제 배포된 Firestore rules 기준으로 의미가 있다.
- rules 실제 배포 후 재실행해야 한다.

## 07. 실기기 QA 체크리스트

PC:

- [ ] Log 리포트 작성
- [ ] 파트너 계정에서 표시 확인
- [ ] 완료/다시 열기
- [ ] 작성자 삭제

Android PWA:

- [ ] PC 작성 리포트 표시
- [ ] Android 작성 리포트 PC 표시
- [ ] 키보드 입력 시 하단 영역 가림 없음

iPhone PWA:

- [ ] 홈 화면 PWA에서 리포트 작성
- [ ] 파트너 기기 실시간 표시
- [ ] 큰 글씨/고대비에서 텍스트 잘림 없음
- [ ] 오프라인 작성 후 온라인 복구 시 동기화 확인

## 08. 관련 문서

- `docs/implementation-work-instructions-2026-06-25-v0-3-0.md`
- `docs/cursor-completion-2026-06-25-v0-3-0-step-1-feedback-sync.md`
- `docs/cursor-completion-2026-06-25-v0-3-0-steps-3-6.md`
- `docs/codex-verification-2026-06-25-v0-3-0-feedback-sync.md`

*SVIL — Tether v0.3.0 Spec | Updated: 2026.06.25*
