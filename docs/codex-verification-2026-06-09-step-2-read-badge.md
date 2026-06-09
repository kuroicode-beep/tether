# Codex Verification Report — Step 2 Read/Badge 모델 정리

- 검증일: 2026-06-09
- 대상: Step 2 — Read/Badge 모델 정리
- 결과: 부분 수정 후 통과
- 보고 위치: Notion 미기록, 프로젝트 `docs/` 저장

## 01. 검증 요약

Step 2 구현 방향은 완료 조건과 대체로 일치했다.

- Chat 배지는 `readBy`에 현재 uid가 없는 상대 메시지 수로 계산됨
- Diary 배지는 상대 일기 중 `isRead !== true` 기준으로 계산됨
- Contents 배지는 `lastRead.contents` 기준이며 legacy `lastRead.more` 폴백이 있음
- BottomNav의 Settings/More 진입은 contents 배지를 자동 해제하지 않음
- ChatScreen은 진입 후 상대 미읽음 메시지를 `markManyAsRead`로 일괄 갱신함

다만 Firestore rules에서 수신자의 `readBy` 업데이트 권한이 너무 넓어, 배포 전 보강이 필요했다.

## 02. 발견 이슈

### 🔴 P1 — 수신자가 `readBy` 배열을 임의로 덮어쓸 수 있음

- 영향 파일: `firestore.rules`
- 원인: 기존 `isRecipientReadByUpdate()`가 변경 필드가 `readBy`뿐인지 여부만 확인했다.
- 영향:
  - 수신자가 자기 uid 추가가 아니라 임의 배열로 `readBy`를 덮어쓸 수 있음
  - 기존 읽음 상태를 제거하거나, 다른 uid를 삽입하는 비정상 상태가 가능함
  - 새 메시지 생성 시 발신자가 `readBy`에 상대 uid를 미리 넣어 배지를 숨길 여지도 있었음
- 위험 수준: 높음

## 03. 수정 내용

`firestore.rules`의 messages 규칙을 보강했다.

- `previousReadBy()` 추가
  - legacy 메시지처럼 `readBy`가 없는 문서는 빈 배열로 취급
- `isValidMessageCreate()` 추가
  - 새 메시지는 발신자 본인의 `readBy: [uid]`로만 생성 허용
- `isRecipientReadByUpdate()` 강화
  - 수신자만 허용
  - 변경 필드는 `readBy`만 허용
  - 기존 `readBy`는 보존해야 함
  - 요청자 uid가 기존에 없어야 함
  - 요청자 uid가 새 배열에 포함되어야 함
  - 배열 크기는 정확히 1개만 증가해야 함

## 04. 검증 결과

- `npm.cmd run build`: 통과
- `firebase deploy --only firestore:rules --dry-run`: 통과
  - `firestore.rules` 컴파일 성공
  - 실제 배포는 수행하지 않음

## 05. 남은 작업

- [ ] `firebase deploy --only firestore:rules` 실제 배포
- [ ] 실기기 QA
  - Android Chrome에서 채팅방 진입 시 chat 배지 해제
  - 일기 목록 진입만으로 diary 배지 유지
  - 일기 카드 열람 시 diary 배지 해제
  - Settings/More 진입 시 contents 배지 유지
  - Contents 화면에서만 contents 배지 해제
- [ ] Git 커밋 및 푸시
- [ ] 필요 시 hosting 배포

## 06. 롤백 방법

문제가 생기면 `firestore.rules`의 messages match 블록을 이전 커밋 상태로 되돌린 뒤 rules를 재배포한다.

권장 롤백 단위:

- `firestore.rules`만 되돌림
- `firebase deploy --only firestore:rules` 재실행

## 07. 결론

Step 2는 rules 보강 후 배포 가능한 상태로 판단한다.

Codex 설계분석 체크리스트 확인 완료
