# ✅ 완료 보고서 — Tether 안정화 Step 3 Firestore rules 및 ownership 강화 (Cursor, 2026.05.29)

원본 작업지시문: `docs/implementation-work-instructions-2026-06-09.md` §Step 3
기준 커밋: 1bb7293
작업 브랜치: main

## 01. 작업 요약

- 목표: UI에서 막는 권한을 Firestore/Storage rules에서도 보장
- 결과: 완료
- 소요 시간: 약 45분

## 02. 작업 로그

- `firestore.rules`: users read 제한(본인·파트너), coupleId 클라이언트 수정 금지, publicProfiles 분리
- `firestore.rules`: photos/contents/history ownership 필드 기준 강화
- `firestore.rules`: contents 파트너 status/rating/review 예외 유지
- `storage.rules`: images/photos 경로 명시 + isCoupleMember 헬퍼
- `src/lib/coupleAuth.ts`: publicProfiles 동기화, 초대 미리보기 publicProfiles 우선 조회
- `scripts/test-e2e-firebase.ts`: Step 3 필수 시나리오 6건+ 확장

## 03. 변경된 파일

| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `firestore.rules` | users/publicProfiles/photos/contents ownership | 핵심 |
| `storage.rules` | images·photos 경로 분리, 헬퍼 함수 | |
| `src/lib/coupleAuth.ts` | syncPublicProfile, findUserByInviteCode | 클라이언트 |
| `scripts/test-e2e-firebase.ts` | Step 3 E2E 시나리오 | |
| `docs/cursor-completion-2026-05-29-step-3-firestore-ownership.md` | 본 보고서 | |

## 04. 구현 결과

### ✅ 완료 항목

- `users/{uid}` read: 본인 또는 동일 coupleId 파트너만
- `users/{uid}` update: `coupleId` 변경 불가 (본인 포함)
- `publicProfiles/{uid}`: 인증 사용자 read, 본인 write — 초대 닉네임 미리보기
- messages: Step 2 readBy 규칙 유지
- photos: `uploadedBy` ownership, caption만 수정
- contents: `addedBy` ownership, 파트너 status 필드만 수정
- history: `authorUid` ownership
- E2E 테스트 확장 (coupleId tamper, readBy, content delete 등)

### ⚠️ 미완료 항목

- `firebase deploy --only firestore:rules,storage` 실제 배포 — 미수행
- `npx tsx scripts/test-e2e-firebase.ts` — rules 배포 후 실행 필요
- 기존 사용자 publicProfiles 백필 마이그레이션 — 신규/갱신 시 자동 동기화만

## 05. 검증 결과

- `npm run build`: 통과
- `firebase deploy --only firestore:rules --dry-run`: 컴파일 통과
- `firebase deploy --only storage --dry-run`: 컴파일 통과

## 06. 특이점 / 결정사항

- 초대 코드 미리보기는 `publicProfiles`로 분리해 users 전체 read 개방을 피함
- `findUserByInviteCode`는 publicProfiles → users(파트너 시에만) 폴백
- contents `updateStatus`는 파트너도 사용하므로 status/rating/review/updatedAt 예외 유지

## 07. 남은 작업

- [ ] Firestore + Storage rules 배포 (담당: 소장님 요청 시 Cursor)
- [ ] E2E 테스트 실행 (rules 배포 후)
- [ ] Codex Step 3 검증
- [ ] Step 4 Optimistic sync (담당: Cursor)

## 08. 핸드오프 메모

- Codex에게: E2E `scripts/test-e2e-firebase.ts` Step 3 블록 검증, publicProfiles 초대 플로우 확인
- 배포 순서: rules → `npx tsx scripts/test-e2e-firebase.ts` → hosting(선택)
- 롤백: `firestore.rules`/`storage.rules` 이전 커밋 revert 후 rules 재배포

## 09. Git

- 커밋 해시: (미커밋)
- push 여부: 아니오
- 배포 여부: dry-run만
