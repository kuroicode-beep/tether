# Tether v0.3.0 Step 1-2 완료보고서 — Log 리포트 Firestore 동기화

작성일: 2026-06-25
담당: Codex

## 01. 작업 요약

- 목표: Log 하단 기능개선/버그 리포트를 localStorage 전용 메모에서 Firestore 커플 공유 데이터로 전환
- 결과: 부분통과
- 자동 검증: `npm run build` 통과, `firebase deploy --only firestore:rules --dry-run` 통과
- 보류: 실제 rules 배포 및 live E2E는 현재 작업 전부터 `firestore.rules`에 다른 변경분이 섞여 있어 임의 진행하지 않음

## 02. 구현 내용

### 1. `useFeedbackReports` 신규 추가

신규 파일:

- `src/hooks/useFeedbackReports.ts`

기능:

- `couples/{coupleId}/feedbackReports/{reportId}` 실시간 구독
- 기능개선/버그 리포트 작성
- 작성자 삭제
- 커플 멤버 상태 변경 `open` / `done`
- optimistic 표시 및 실패 rollback
- `clientId` 기반 pending reconcile

### 2. Release Log 화면 연동

변경 파일:

- `src/screens/ReleaseLogScreen.tsx`

변경:

- 기존 localStorage 표시 데이터를 Firestore 구독 데이터로 교체
- 기존 localStorage 메모를 1회 마이그레이션
- 마이그레이션 성공 시 `tether_release_log_feedback_memos_backup_v030`에 백업 후 원본 키 제거
- 마이그레이션 실패 시 원본 localStorage 삭제 금지
- 저장 중 / 불러오는 중 / 빈 상태 / 오류 / 동기화 중 UI 추가
- 작성자 닉네임, 작성 시간, 상태 chip, 완료/다시 열기, 삭제 버튼 표시

### 3. Firestore rules 추가

변경 파일:

- `firestore.rules`

추가 경로:

```text
couples/{coupleId}/feedbackReports/{reportId}
```

권한:

- read: 커플 멤버만
- create: 커플 멤버만, `authorUid == request.auth.uid`
- update: 커플 멤버만, `status`, `updatedAt`, `doneAt`, `doneBy`만 변경 가능
- delete: 작성자만

주의:

- 이 파일에는 작업 전부터 교환일기 reply rules 변경분도 존재했다. 이번 작업의 신규 변경은 `feedbackReports` match 블록이다.

### 4. E2E 테스트 항목 추가

변경 파일:

- `scripts/test-e2e-firebase.ts`

추가 검증:

- 커플 멤버 report create 허용
- 파트너 report read 허용
- 비멤버 report read/create 거부
- 파트너 status update 허용
- text tamper 거부
- authorUid tamper 거부
- 파트너 delete 거부
- 작성자 delete 허용

## 03. 변경된 파일

| 파일 경로 | 변경 내용 | 비고 |
|---|---|---|
| `src/hooks/useFeedbackReports.ts` | Firestore feedback report hook 신규 | 신규 |
| `src/screens/ReleaseLogScreen.tsx` | Log 메모를 Firestore 공유 리포트로 전환 | 수정 |
| `firestore.rules` | `feedbackReports` rules 추가 | dry-run 통과 |
| `scripts/test-e2e-firebase.ts` | feedback report ownership E2E 추가 | 배포 후 실행 필요 |
| `docs/cursor-completion-2026-06-25-v0-3-0-step-1-feedback-sync.md` | 완료보고서 | 신규 |

## 04. 검증 결과

통과:

```bash
npm run build
firebase deploy --only firestore:rules --dry-run
```

보류:

```bash
npx tsx scripts/test-e2e-firebase.ts
```

보류 이유:

- live E2E는 실제 배포된 Firestore rules 기준으로 동작한다.
- 현재 rules 파일에는 이번 작업 외의 기존 변경분도 섞여 있어, 실제 배포는 별도 승인 후 진행하는 것이 안전하다.

## 05. 남은 작업

- [ ] `firebase deploy --only firestore:rules` 실제 배포
- [ ] 배포 후 `npx tsx scripts/test-e2e-firebase.ts` 실행
- [ ] Log 화면 PC/Android/iPhone 실기기 확인
- [ ] 파트너 기기와 실시간 동기화 확인
- [ ] 고대비/큰 글씨에서 카드 표시 확인

## 06. 핸드오프 메모

Cursor에게:

- `ReleaseLogScreen`의 feedback UI는 Firestore hook으로 전환되어 있다.
- 추가 표시 개선은 Step 3에서 카드 컴포넌트 분리 여부를 판단하면 된다.
- 현재 localStorage는 마이그레이션과 백업 용도로만 남아 있다.

Codex에게:

- live E2E는 rules 배포 후 실행해야 의미가 있다.
- `firestore.rules`에 기존 diary reply 변경분이 섞여 있으므로 배포 전 diff를 재확인해야 한다.

소장님에게:

- Log 하단 리포트는 이제 커플 공유 데이터로 설계되어 있다.
- 실제 동기화 확인은 rules 배포와 hosting 배포 후 두 기기에서 테스트해야 한다.

## 07. Git 커밋

- 커밋 해시: 미커밋
- 배포 여부: 미배포
