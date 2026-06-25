# ✅ Codex 검증 보고서 — Tether v0.4.0 E2E 후속 검증 (2026.06.25)

원본 작업지시문:
- "계속 진행해"
- v0.4.0 배포 후 남은 자동 검증 보강

## 01. 작업 요약
- 목표: v0.4.0 신규 자료실 기능의 Firestore/Storage 보안 회귀 테스트 추가
- 결과: 부분통과
- 소요 시간: 약 10분

## 02. 작업 로그
- [2026-06-25 20:01] `scripts/test-e2e-firebase.ts`에 `links`, `dateRecipes`, 링크 파일 Storage 경로 테스트 추가
- [2026-06-25 20:02] cleanup에 신규 문서/파일 삭제 루틴 추가
- [2026-06-25 20:03] `npm run build` 실행
- [2026-06-25 20:03] `npx tsx scripts/test-e2e-firebase.ts` 실행

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `scripts/test-e2e-firebase.ts` | v0.4.0 `links`, `dateRecipes`, 링크 파일 Storage 보안 테스트 추가 | 신규 자동 검증 |

## 04. 구현 결과
✅ 완료 항목:
- 파트너 shared link read 허용 테스트 추가
- 비파트너 shared link read 거부 테스트 추가
- 파트너 shared link delete 거부 테스트 추가
- shared link `createdBy` spoof 거부 테스트 추가
- 비파트너 link file upload 거부 테스트 추가
- 파트너 date recipe read 허용 테스트 추가
- 비파트너 date recipe read 거부 테스트 추가
- 파트너 date recipe delete 거부 테스트 추가
- date recipe `createdBy` spoof 거부 테스트 추가
- 테스트 cleanup에 `links`, `dateRecipes` 삭제 추가

⚠️ 미완료 항목:
- 실제 E2E 전체 실행은 기존 테스트 부트스트랩 단계에서 `PERMISSION_DENIED`로 중단됨.
- 원인: 현재 운영 Firestore rules는 Google 로그인 사용자만 `users/{uid}` create를 허용하는데, 기존 E2E 스크립트는 `signInAnonymously()` 후 클라이언트 권한으로 `users` 문서를 생성한다.

## 05. 특이점 / 결정사항
- v0.4.0 신규 규칙 자체는 배포 시 Firestore/Storage compile 및 release가 통과했다.
- E2E 스크립트는 이제 신규 케이스를 포함하지만, 실행 가능하게 하려면 테스트 데이터 준비 방식을 바꿔야 한다.
- 권장 방향: Admin SDK 또는 전용 테스트 callable로 테스트 users/couple/invite를 준비하고, 이후 클라이언트 SDK로 권한 시나리오를 검증한다.

## 06. 남은 작업
- [ ] E2E bootstrap을 Google-only 가입 정책에 맞게 재설계 (담당: Codex/Cursor)
- [ ] Admin SDK 인증 방식 또는 테스트 전용 Cloud Function 방식 결정 (담당: Codex)
- [ ] 재설계 후 `npx tsx scripts/test-e2e-firebase.ts` 재실행 (담당: Codex)

## 07. 핸드오프 메모
- Cursor에게: 단순히 rules를 풀어서 anonymous create를 허용하면 안 됨. 앱 정책은 Google-only 가입이므로 테스트 준비 방식만 우회해야 함.
- Codex에게: 기존 E2E는 현재 운영 보안 정책과 불일치한다. 신규 v0.4.0 테스트 케이스는 추가됐으나 bootstrap 수정 전까지 전체 실행은 실패한다.
- 주의사항: 기존 사용자/환경 파일 `.cursor/*`, `.firebase/`, 기타 untracked 파일은 건드리지 않음.

## 08. Git 커밋
- 커밋 해시: 후속 커밋 예정
- 배포 여부: 코드/규칙 변경 없음, 배포 불필요

## 09. 검증 명령
- `npm run build` — 통과
- `npx tsx scripts/test-e2e-firebase.ts` — 실패
  - 실패 지점: anonymous 사용자로 `users/{uid}` 문서 생성
  - 오류: `PERMISSION_DENIED: Missing or insufficient permissions`

Codex 설계분석 체크리스트 확인 완료
