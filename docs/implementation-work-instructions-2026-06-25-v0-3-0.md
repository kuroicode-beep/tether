# Tether v0.3.0 작업지시문 — 기능개선·접근성·커플 동기화

작성일: 2026-06-25  
기준 버전: Tether v0.2.0  
목표: 이미 반영된 v0.2.0 안정화 항목은 유지하고, 남은 개선사항인 Log 리포트 동기화, 표시 문제, 접근성 보강, 오프라인/동기화 기반을 v0.3.0 범위로 정리한다.

---

## 00. 공통 원칙

모든 Step에 공통 적용한다.

1. 기존 사용자 데이터는 삭제하지 않는다.
2. `users/{uid}.coupleId`는 클라이언트에서 직접 변경하지 않는다.
3. 커플 공유 데이터의 source of truth는 Firestore로 둔다.
4. `localStorage`는 임시 캐시 또는 1회 마이그레이션 용도로만 사용한다.
5. Firestore schema/rules 변경이 있는 Step은 rules 검증을 함께 진행한다.
6. 각 Step 완료 시 `npm run build`를 통과시킨다.
7. 각 Step 완료 시 `docs/cursor-completion-YYYY-MM-DD-[작업명].md` 완료보고서를 작성한다.
8. Codex 검증보고서는 Notion이 아니라 `docs/`에 Markdown으로 저장한다.
9. iOS/Android/PWA 관련 동작은 실기기 QA 전까지 “자동 검증 통과”와 “최종 완료”를 분리한다.

---

## 01. v0.3.0 작업 순서

| Step | 작업명 | 목적 | 우선순위 | 담당 권장 |
|---|---|---|---|---|
| 1 | Log 리포트 Firestore 동기화 | 기능개선/버그 메모를 커플 공유 데이터로 전환 | Critical | Cursor |
| 2 | Feedback rules 및 E2E 검증 | 공유 리포트 권한·무결성 보장 | Critical | Cursor + Codex |
| 3 | Log 리포트 표시 문제 해결 | 로딩/오류/빈 상태/고대비/큰 글씨 개선 | High | Cursor |
| 4 | 접근성 레이블·동적 알림 보강 | MoodChip/채팅/Toast 스크린 리더 대응 | High | Cursor |
| 5 | 오프라인 유지 기능 검토 및 적용 | 네트워크 불안정 대비, Firestore 캐시 기반 마련 | Medium | Codex 설계 후 Cursor |
| 6 | v0.3.0 최종 QA·릴리즈 정리 | 실기기 검증, Log/spec/docs 정리 | Required | Codex + 소장님 |

---

# Step 1. Log 리포트 Firestore 동기화

## 1-1. 목표

현재 Log 하단의 기능개선/버그 메모는 `localStorage` 기반이라 다음 문제가 있다.

- 커플 간 동기화가 되지 않는다.
- 다른 기기에서 보이지 않는다.
- 앱 삭제/브라우저 데이터 삭제 시 사라진다.
- 저장 실패/동기화 상태를 알 수 없다.

v0.3.0에서는 이 기능을 커플 공유 리포트로 승격한다.

## 1-2. 현재 상태

현재 관련 구현:

- `src/screens/ReleaseLogScreen.tsx`
- `FEEDBACK_MEMO_KEY = 'tether_release_log_feedback_memos'`
- `localStorage`에 메모 저장

현재 구현은 “개인 로컬 메모”로는 동작하지만, “커플 공유 기능개선/버그 리포트” 요구에는 부족하다.

## 1-3. 목표 데이터 모델

Firestore 경로:

```text
couples/{coupleId}/feedbackReports/{reportId}
```

문서 필드:

```ts
type FeedbackReportType = 'improvement' | 'bug'
type FeedbackReportStatus = 'open' | 'done'

type FeedbackReport = {
  id: string
  clientId: string
  type: FeedbackReportType
  text: string
  status: FeedbackReportStatus
  authorUid: string
  authorNickname: string
  createdAt: Timestamp
  updatedAt?: Timestamp
  doneAt?: Timestamp
  doneBy?: string
}
```

## 1-4. 영향 파일

- `src/screens/ReleaseLogScreen.tsx`
- 신규 권장: `src/hooks/useFeedbackReports.ts`
- 신규 권장: `src/types/feedback.ts` 또는 hook 내부 type
- `src/lib/clientId.ts`
- `firestore.rules`
- `scripts/test-e2e-firebase.ts`
- 완료보고서: `docs/cursor-completion-2026-06-25-v0-3-0-step-1-feedback-sync.md`

## 1-5. 구현 지시

### 1. `useFeedbackReports` hook 추가

기능:

- `coupleId`, `uid`, `nickname` 입력
- Firestore 실시간 구독
- 최신순 정렬
- 리포트 추가
- 리포트 삭제
- 리포트 완료/열림 상태 변경
- optimistic 추가 및 실패 rollback

권장 API:

```ts
export function useFeedbackReports(
  coupleId: string | null,
  uid: string | null,
  nickname: string,
) {
  return {
    reports,
    loading,
    error,
    addReport,
    deleteReport,
    toggleReportStatus,
  }
}
```

### 2. localStorage 직접 저장 제거

`ReleaseLogScreen`에서 아래 구조를 제거하거나 마이그레이션 보조 용도로만 남긴다.

```ts
localStorage.setItem(FEEDBACK_MEMO_KEY, JSON.stringify(memos))
```

최종 상태:

- 화면 표시 데이터는 Firestore 구독 결과 사용
- `localStorage`는 기존 메모 1회 마이그레이션에만 사용

### 3. 기존 로컬 메모 1회 마이그레이션

기존 `tether_release_log_feedback_memos`가 있으면:

1. Firestore reports가 비어 있거나 아직 해당 local memo가 업로드되지 않았는지 확인
2. 각 메모를 `feedbackReports`로 업로드
3. 성공 후 `tether_release_log_feedback_memos_migrated` 또는 백업 키로 이동

권장:

```text
tether_release_log_feedback_memos_backup_v030
```

주의:

- 마이그레이션 실패 시 기존 localStorage 삭제 금지
- 중복 업로드 방지를 위해 `clientId` 또는 migration marker 사용

### 4. UI 동작

Log 하단 섹션은 유지한다.

추가할 UI 상태:

- 저장 중
- 저장 실패
- 동기화 중
- 빈 상태
- 완료된 리포트 표시

리포트 카드 표시:

- 타입 chip: 기능개선 / 버그
- 작성자 닉네임
- 작성 시간
- 상태: open / done
- 내용
- 완료 토글 버튼
- 작성자 삭제 버튼

### 5. 완료 조건

- A 기기에서 기능개선 메모 작성 → B 기기에 실시간 표시
- B 기기에서 버그 메모 작성 → A 기기에 실시간 표시
- 새로고침 후에도 메모 유지
- 앱 재설치 후 Google 복구 시 같은 couple의 리포트 표시
- localStorage 삭제 후에도 Firestore 리포트 표시
- `npm run build` 통과

---

# Step 2. Feedback Firestore rules 및 E2E 검증

## 2-1. 목표

커플 공유 리포트가 서버 규칙에서도 안전하게 보호되도록 한다.

## 2-2. 영향 파일

- `firestore.rules`
- `scripts/test-e2e-firebase.ts`
- 필요 시 신규 테스트 helper
- 완료보고서: `docs/cursor-completion-2026-06-25-v0-3-0-step-2-feedback-rules.md`

## 2-3. Rules 요구사항

경로:

```text
couples/{coupleId}/feedbackReports/{reportId}
```

권한:

- read: couple member만 허용
- create: couple member만 허용
- update: couple member만 허용하되 변경 가능 필드 제한
- delete: 작성자만 허용

create 검증:

- `authorUid == request.auth.uid`
- `type in ['improvement', 'bug']`
- `status == 'open'`
- `text`는 string, 1자 이상, 500자 이하
- `clientId`는 string
- `createdAt` 존재

update 검증:

허용 필드:

- `status`
- `updatedAt`
- `doneAt`
- `doneBy`

상태 변경:

- `status`: `open` 또는 `done`
- `doneBy`: `request.auth.uid` 또는 null

금지:

- `authorUid` 변경
- `text` 변경
- `type` 변경
- `createdAt` 변경
- `clientId` 변경

## 2-4. E2E 테스트 항목

`scripts/test-e2e-firebase.ts`에 아래 항목 추가:

- 커플 멤버 report create 허용
- 비멤버 report read 거부
- 비멤버 report create 거부
- 작성자가 report delete 허용
- 파트너가 report delete 거부
- 파트너가 status done update 허용
- 파트너가 text update 거부
- authorUid tamper 거부

## 2-5. 검증 명령

```bash
npm run build
firebase deploy --only firestore:rules --dry-run
npx tsx scripts/test-e2e-firebase.ts
```

실제 배포는 소장님 승인 후:

```bash
firebase deploy --only firestore:rules
```

## 2-6. 완료 조건

- 모든 feedback rules 테스트 통과
- 기존 diary/chat/content/photo rules 회귀 없음
- `npm run build` 통과
- rules dry-run 통과

---

# Step 3. Log 리포트 표시 문제 해결

## 3-1. 목표

Log 하단 리포트 영역의 사용성과 접근성을 정리한다.

## 3-2. 영향 파일

- `src/screens/ReleaseLogScreen.tsx`
- `src/styles/tokens.css`
- 필요 시 신규 컴포넌트: `src/components/FeedbackReportCard.tsx`
- 완료보고서: `docs/cursor-completion-2026-06-25-v0-3-0-step-3-feedback-display.md`

## 3-3. 구현 지시

### 1. UI 상태 분리

아래 상태를 명확히 표시한다.

- loading: `리포트를 불러오는 중...`
- empty: `아직 남긴 리포트가 없어요.`
- error: `리포트를 불러오지 못했어요. 다시 시도해주세요.`
- saving: 버튼에 `저장 중...`
- sync pending: optimistic 카드에 `동기화 중`

### 2. 카드 구조

각 리포트 카드:

- 타입 chip
- 상태 chip
- 작성자
- 작성시간
- 본문
- 완료/다시 열기 버튼
- 삭제 버튼

긴 본문:

- `white-space: pre-wrap`
- `overflow-wrap: anywhere`
- `word-break: keep-all`

### 3. 고대비 모드

고대비에서 아래 요소가 모두 보이도록 한다.

- 입력창
- 타입 버튼
- 리포트 카드
- 상태 chip
- 삭제/완료 버튼
- 에러 메시지

기준:

- 검은 배경
- 흰 글씨
- 2px 흰 보더
- 최소 50px 터치 타겟

### 4. 모바일 키보드 대응

메모 입력 중 하단 영역이 키보드에 가려지지 않는지 확인한다.

필요 시:

- `pb-32`
- safe-area padding
- textarea `min-height` 기반

### 5. 완료 조건

- iPhone/Android/PC에서 입력창과 버튼이 가려지지 않음
- 고대비에서 모든 텍스트가 읽힘
- 큰 폰트 L에서도 카드 내용이 잘리지 않음
- 삭제/완료 버튼 터치 타겟 50px 이상

---

# Step 4. 접근성 레이블·동적 알림 보강

## 4-1. 목표

스크린 리더와 키보드 사용자에게 주요 상태와 동적 변화를 명확히 전달한다.

## 4-2. 영향 파일

- `src/components/MoodChip.tsx`
- `src/components/MessageBubble.tsx`
- `src/components/ToastNotification.tsx`
- `src/components/ContentActionSheet.tsx`
- `src/screens/ReleaseLogScreen.tsx`
- `src/styles/tokens.css`
- 완료보고서: `docs/cursor-completion-2026-06-25-v0-3-0-step-4-accessibility-labels.md`

## 4-3. 구현 지시

### 1. MoodChip aria-label

현재 `MoodChip`은 시각적 label만 있다.

추가:

```tsx
aria-label={`기분 태그 ${label}${active ? ' 선택됨' : ' 선택 안 됨'}`}
```

선택 가능한 chip이면 `button` 사용을 검토한다. 단, 현재 화면 구조에서 단순 표시 chip인지 선택 control인지 구분해야 한다.

권장:

- 표시용: `span role="text" aria-label=...`
- 선택용: 별도 button 컴포넌트로 분리

### 2. 채팅 말풍선 접근성

`MessageBubble`에 스크린 리더 문맥 추가:

- 보낸 사람
- 시간
- 메시지 내용 또는 사진 메시지

예:

```tsx
aria-label={`${senderName} 메시지, ${timeText}, ${message.text}`}
```

이미지 메시지:

```text
상대방이 보낸 사진 메시지
```

### 3. ToastNotification

동적 알림 영역에:

```tsx
role="status"
aria-live="polite"
```

닫기 버튼에는 명확한 label:

```tsx
aria-label="알림 닫기"
```

### 4. Dialog/Sheet focus

대상:

- 사진 미리보기 sheet
- 사진 viewer
- push permission sheet
- content action sheet

요구:

- 열릴 때 첫 action으로 focus 이동
- Escape 또는 닫기 동작 가능 여부 확인
- 닫힌 후 원래 trigger로 focus 복귀 가능하면 적용

### 5. Windows High Contrast Mode 대응

CSS에 아래 계열 검토:

```css
@media (forced-colors: active) {
  .hc-readable-box {
    forced-color-adjust: none;
    border: 2px solid CanvasText;
  }
}
```

단, 과도한 `forced-color-adjust: none`은 OS 접근성 설정을 막을 수 있으므로 핵심 구분 요소에만 적용한다.

## 4-4. 완료 조건

- MoodChip이 스크린 리더에서 의미 있게 읽힘
- 채팅 메시지가 보낸 사람/내용 기준으로 읽힘
- Toast가 동적 알림으로 전달됨
- 주요 modal/sheet 닫기 버튼에 label 존재
- `npm run build` 통과

---

# Step 5. 오프라인 유지 기능 검토 및 적용

## 5-1. 목표

네트워크 불안정 상황에서도 Firestore 읽기 캐시와 pending write 경험을 개선한다.

## 5-2. 현재 상태

`src/lib/firebase.ts`는 현재:

```ts
export const db = getFirestore(app)
```

오프라인 캐시가 명시적으로 활성화되어 있지 않다.

## 5-3. 주의사항

Firebase v11에서는 기존 `enableIndexedDbPersistence`보다 초기화 시점의 local cache 설정이 권장될 수 있다.

적용 전 공식 문서 확인 필요.

검토 대상:

- `initializeFirestore`
- `persistentLocalCache`
- `persistentMultipleTabManager`

## 5-4. 영향 파일

- `src/lib/firebase.ts`
- `src/hooks/useFeedbackReports.ts`
- `src/hooks/useChat.ts`
- `src/hooks/useDiary.ts`
- 완료보고서: `docs/cursor-completion-2026-06-25-v0-3-0-step-5-offline-persistence.md`

## 5-5. 구현 지시

### 1. Codex 선검토

이 Step은 구현 전 Codex가 현재 Firebase SDK 버전과 권장 API를 확인한다.

확인:

- package `firebase` version
- v11 Firestore persistence API
- multi-tab PWA 동작
- iOS Safari/PWA IndexedDB 제한

### 2. Firebase 초기화 변경

가능하면:

```ts
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})
```

단, 이미 `getFirestore(app)`를 사용한 뒤에는 `initializeFirestore`로 바꿀 수 없으므로 초기화 순서 주의.

### 3. UI pending 상태 표시

Feedback reports에서 오프라인 작성 시:

- optimistic card 표시
- `동기화 대기 중` 표시
- 실패 시 rollback 또는 retry

### 4. 완료 조건

- 온라인 상태에서 기존 기능 정상
- 오프라인에서 작성 시 UI가 멈추지 않음
- 네트워크 복구 후 Firestore에 반영됨
- iOS/Android/PC에서 치명적 초기화 오류 없음

---

# Step 6. v0.3.0 최종 QA·릴리즈 정리

## 6-1. 목표

v0.3.0 범위의 구현을 최종 검증하고 릴리즈 문서를 정리한다.

## 6-2. 영향 파일

- `docs/spec-tether-v0.3.0.md` 신규
- `src/screens/ReleaseLogScreen.tsx`
- `package.json` 필요 시 version 검토
- `src/lib/appVersion.ts`
- 완료보고서: `docs/cursor-completion-2026-06-25-v0-3-0-final-release.md`
- Codex 검증보고서: `docs/codex-verification-2026-06-25-v0-3-0-final.md`

## 6-3. 자동 검증

필수:

```bash
npm run build
```

rules 변경 시:

```bash
firebase deploy --only firestore:rules --dry-run
npx tsx scripts/test-e2e-firebase.ts
```

functions 변경 시:

```bash
cd functions
npm run build
```

## 6-4. 실기기 QA

### PC

- [ ] Log 하단 리포트 작성
- [ ] 리포트 완료/삭제
- [ ] 새로고침 후 유지
- [ ] 고대비 표시
- [ ] 큰 글씨 L 표시

### Android PWA

- [ ] PC에서 작성한 리포트가 Android에 표시
- [ ] Android에서 작성한 리포트가 PC에 표시
- [ ] 키보드 입력 시 하단 영역 가림 없음
- [ ] 오프라인/온라인 복구 확인

### iPhone PWA

- [ ] 홈 화면 PWA에서 Log 리포트 작성
- [ ] 파트너 기기에 실시간 표시
- [ ] 고대비/큰 글씨에서 입력창과 카드 표시
- [ ] 키보드 열림 상태에서 메모 추가 가능

## 6-5. Release Log 항목

v0.3.0 최종 항목 예시:

```text
Tether v0.3.0 업데이트.
Log 하단 기능개선/버그 리포트를 커플 간 실시간 동기화로 전환하고, 접근성 레이블·고대비 표시·오프라인 안정성을 보강했습니다.
```

## 6-6. 완료 조건

- Step 1-5 완료보고서 존재
- Codex 최종 검증보고서 존재
- build 통과
- rules 테스트 통과
- 실기기 QA 체크리스트 작성
- 배포 URL 확인
- 커밋/푸시 완료

---

# 07. v0.3.0 커밋 메시지 권장

## Step 1

```text
Sync release log feedback reports through Firestore.
```

## Step 2

```text
Add Firestore rules and tests for feedback reports.
```

## Step 3

```text
Improve feedback report display states and high contrast UI.
```

## Step 4

```text
Add accessibility labels for mood chips messages and notifications.
```

## Step 5

```text
Enable Firestore offline persistence for shared app data.
```

## Step 6

```text
Release Tether v0.3.0 feedback sync and accessibility update.
```

---

# 08. 우선 착수 지시문

Cursor가 가장 먼저 수행할 작업은 아래 하나로 제한한다.

```text
Tether v0.3.0 Step 1 — Log 리포트 Firestore 동기화

목표:
- 현재 Log 하단 기능개선/버그 메모를 localStorage에서 Firestore 커플 공유 데이터로 전환한다.
- 같은 couple의 두 사용자가 리포트를 실시간으로 함께 볼 수 있게 한다.
- 기존 localStorage 메모는 1회 마이그레이션한다.

영향 파일:
- src/screens/ReleaseLogScreen.tsx
- 신규 src/hooks/useFeedbackReports.ts
- src/lib/clientId.ts
- firestore.rules는 Step 2에서 본격 수정하되, Step 1 구현 중 필요한 필드는 Step 2에 명확히 인계한다.

금지:
- 기존 localStorage 메모를 마이그레이션 성공 전 삭제하지 말 것
- users/{uid}.coupleId 수정 금지
- Log 기존 릴리즈 기록 삭제 금지
- Firestore rules를 우회하는 클라이언트 구조 금지

완료 조건:
- A 기기에서 작성한 기능개선/버그 리포트가 B 기기에 실시간 표시
- 새로고침 후 유지
- 저장 실패 시 오류 표시
- npm run build 통과
- docs/cursor-completion-2026-06-25-v0-3-0-step-1-feedback-sync.md 작성
```

---

Codex 설계분석 체크리스트 확인 완료
