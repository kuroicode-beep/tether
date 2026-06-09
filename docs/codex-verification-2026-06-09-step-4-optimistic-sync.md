# Codex Verification Report — Step 4 Optimistic sync / clientId reconciliation

- 검증일: 2026-06-09
- 대상: Step 4 — Optimistic sync / clientId reconciliation
- 결과: 수정 후 통과
- 보고 위치: Notion 미기록, 프로젝트 `docs/` 저장

## 01. 검증 요약

Step 4 구현은 optimistic write와 Firestore snapshot reconciliation을 `clientId` 중심으로 정리하는 방향에 맞게 반영되어 있었다.

- `src/lib/clientId.ts`에 `createClientId`, `createOptimisticId` 추가
- chat, diary, contents, photos, history create write에 `clientId` 추가
- optimistic item id가 `opt_${clientId}` 형식으로 통일됨
- snapshot 수신 시 server `clientId`를 읽어 pending item과 매칭함
- 주요 실패 케이스에서 optimistic 제거 또는 UI rollback이 추가됨

다만 `reconcilePending`의 fallback 조건이 너무 넓어 Step 4의 핵심 완료 조건을 깨는 문제가 있어 수정했다.

## 02. 발견 이슈 및 수정

### P1 — `clientId`가 있어도 fallback 매칭으로 다른 pending이 삭제될 수 있음

- 영향 파일: `src/lib/syncHelpers.ts`
- 원인:
  - 기존 로직은 `clientId` exact match를 먼저 계산했지만, 실패하면 항상 fallback matcher도 허용했다.
- 재현 위험:
  - 같은 텍스트 메시지를 연속 전송
  - 첫 번째 서버 문서 도착
  - 두 번째 pending이 같은 sender/text 조건으로 fallback match되어 함께 삭제될 수 있음
- 영향:
  - 같은 텍스트 연속 전송 시 개별 bubble 유지라는 Step 4 완료 조건이 깨질 수 있음
- 수정:
  - `clientId`가 있는 pending/server는 exact match로만 reconciliation
  - fallback은 pending과 server 양쪽 모두 `clientId`가 없는 legacy 조합에서만 사용

### P2 — `markDiaryRead` 실패 rollback이 항상 `false`로 되돌림

- 영향 파일: `src/hooks/useDiary.ts`
- 원인:
  - 실패 시 이전 값을 기억하지 않고 `isRead: false`로 되돌렸다.
- 영향:
  - 이미 읽은 일기에 대해 update 실패가 발생하면 UI가 오히려 미읽음 상태로 바뀔 수 있음
- 수정:
  - optimistic 적용 전 `previousIsRead`를 캡처
  - 실패 시 이전 값으로 정확히 rollback

## 03. 확인한 정상 동작 구조

- Chat text/image:
  - optimistic item과 Firestore create payload가 동일한 `clientId` 사용
  - 실패 시 pending 제거 및 blob URL revoke
- Diary:
  - diary create에 `clientId` 반영
  - reply nested object에 `clientId` 반영
  - read/reply 실패 rollback 존재
- Contents:
  - create에 `clientId` 반영
  - status update 실패 시 이전 item으로 rollback
- Photos:
  - create에 `clientId` 반영
  - caption update 실패 시 이전 caption으로 rollback
- History:
  - create에 `clientId` 반영
- Anniversaries:
  - persist 실패 시 이전 배열로 rollback

## 04. 검증 결과

- `npm.cmd run build`: 통과

실제 실기기 QA와 네트워크 실패 주입 테스트는 수행하지 않았다.

## 05. 남은 작업

- [ ] 실기기 QA: 같은 텍스트 연속 채팅 전송
- [ ] 실기기 QA: 이미지 연속 전송
- [ ] 실패 주입 QA: content status, photo caption, diary read/reply rollback
- [ ] Git 커밋 및 푸시

## 06. 결론

Step 4는 Codex 수정 후 build 기준 통과 상태다. 핵심 reconciliation 결함은 수정되었고, 배포 전 실기기 연속 전송 QA를 권장한다.

Codex 설계분석 체크리스트 확인 완료
