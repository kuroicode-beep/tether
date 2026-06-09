# Codex Verification Report — Step 3 Firestore Rules 및 Ownership 강화

- 검증일: 2026-06-09
- 대상: Step 3 — Firestore rules 및 ownership 강화
- 결과: 수정 후 통과
- 보고 위치: Notion 미기록, 프로젝트 `docs/` 저장

## 01. 검증 요약

Step 3 구현은 ownership 강화 방향과 대체로 일치했다.

- `users/{uid}` read 범위가 본인 및 동일 couple 파트너로 제한됨
- `users/{uid}.coupleId` 클라이언트 수정이 차단됨
- `publicProfiles/{uid}`가 초대 미리보기용 공개 닉네임 문서로 분리됨
- `messages`의 Step 2 `readBy` 규칙이 유지됨
- `photos`, `contents`, `history` ownership 규칙이 추가됨
- `coupleAuth.ts`에서 public profile 동기화 및 초대 미리보기 우선 조회가 반영됨
- E2E 테스트에 Step 3 ownership 시나리오가 추가됨

## 02. 발견 이슈 및 수정

### P1 — 깨진 주석 줄에 `match`가 붙어 rules 블록 경계가 불안정함

- 영향 파일: `firestore.rules`
- 증상: `publicProfiles`, `diary`, `contents`의 `match` 선언이 깨진 주석 문자열과 같은 줄에 붙어 있었다.
- 위험:
  - rules 파서가 EOF brace 오류를 냄
  - 사람이 보기에도 실제 match 범위를 오해하기 쉬움
- 수정:
  - `firestore.rules`를 ASCII 주석 기반으로 재정리
  - 모든 `match` 블록을 명시적으로 분리
  - Firestore dry-run 컴파일 통과 확인

### P2 — `publicProfiles` write 범위가 너무 넓음

- 영향 파일: `firestore.rules`
- 원인: 본인 uid면 임의 필드를 public profile에 쓸 수 있었다.
- 위험:
  - 인증 사용자 전체가 읽는 공개 문서에 의도치 않은 필드가 노출될 수 있음
- 수정:
  - `publicProfiles/{uid}` create/update는 `nickname` 단일 필드만 허용
  - `nickname`은 string, 1~40자만 허용

### P2 — `users/{uid}` self-update가 `coupleId` 외 모든 필드를 허용함

- 영향 파일: `firestore.rules`
- 원인: `coupleId` 보존만 확인하고 다른 필드는 제한하지 않았다.
- 위험:
  - 클라이언트가 user 문서에 임의 필드를 추가할 수 있음
- 수정:
  - self-update 허용 필드를 실제 클라이언트 사용 범위로 제한
  - 허용 필드: `nickname`, `inviteCode`, `fcmToken`, `fcmUpdatedAt`, `notificationSettings`, `lastRead`

### P2 — Storage catch-all이 couple 하위 모든 경로 write를 허용함

- 영향 파일: `storage.rules`
- 원인: `couples/{coupleId}/{allPaths=**}` catch-all이 남아 있었다.
- 위험:
  - 앱에서 쓰지 않는 임의 couple storage 경로에도 멤버 write가 가능함
- 수정:
  - 앱에서 실제 사용하는 media 경로만 허용
  - 허용 경로: `images`, `photos`, `diary`, `history`

## 03. 검증 결과

- `npm.cmd run build`: 통과
- `firebase deploy --only firestore:rules --dry-run`: 통과
- `firebase deploy --only storage --dry-run`: 통과

실제 배포는 수행하지 않았다.

## 04. E2E 테스트 판단

`npx tsx scripts/test-e2e-firebase.ts`는 실제 배포된 Firebase rules를 대상으로 실행되는 live E2E다.

이번 검증에서는 rules를 실제 배포하지 않았으므로 실행하지 않았다. 배포 후 아래 순서로 실행하는 것이 맞다.

1. `firebase deploy --only firestore:rules,storage`
2. `npx tsx scripts/test-e2e-firebase.ts`

## 05. 남은 작업

- [ ] Firestore + Storage rules 실제 배포
- [ ] 배포 후 E2E 테스트 실행
- [ ] 실기기 QA
- [ ] Git 커밋 및 푸시

## 06. 롤백 방법

문제가 생기면 다음 파일을 이전 커밋으로 되돌린 뒤 rules를 재배포한다.

- `firestore.rules`
- `storage.rules`

권장 명령:

```bash
firebase deploy --only firestore:rules,storage
```

## 07. 결론

Step 3는 Codex 수정 후 배포 가능한 상태로 판단한다. 다만 live E2E는 실제 rules 배포 이후에 실행해야 한다.

Codex 설계분석 체크리스트 확인 완료
