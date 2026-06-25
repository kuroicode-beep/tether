제목: ✅ Codex 검증 보고서 — 실사용자 외 Firebase 회원 데이터 정리 (2026.06.25)
원본 작업지시문:
- 실사용자는 `kuroicode@gmail.com`, `phumphum80@gmail.com` 두 명뿐이므로 나머지 회원 데이터를 정리

## 01. 작업 요약
- 목표: Firebase Auth와 Firestore 회원/커플 테스트 잔여 데이터를 실제 사용자 2명 기준으로 정리
- 결과: 통과
- 소요 시간: 약 15분

## 02. 작업 로그
- [2026-06-25] Firebase 프로젝트 `tether-d1dab` 확인
- [2026-06-25] Firebase Auth export로 총 21개 계정 확인
- [2026-06-25] 실사용자 2명 보존, 이메일 없는 익명/테스트 Auth 계정 19개 삭제
- [2026-06-25] Firestore 루트 컬렉션 확인: `users`, `publicProfiles`, `couples`, `invites`
- [2026-06-25] Firestore 잔여 테스트 문서 정리
- [2026-06-25] 최종 Auth/Firestore 상태 재검증

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `docs/codex-verification-2026-06-25-user-data-cleanup.md` | 운영 정리 및 검증 보고서 추가 | 본 문서 |

## 04. 구현 결과
✅ 완료 항목:
- Firebase Auth: 21개 계정 중 19개 삭제, 실사용자 2명만 유지
- Firestore `users`: 104개 문서 중 실사용자 2개만 유지
- Firestore `publicProfiles`: 41개 문서 중 실사용자 2개만 유지
- Firestore `couples`: 52개 문서 중 실제 커플 1개만 유지
- Firestore `invites`: 70개 초대 문서 전체 삭제

최종 유지 상태:
- Auth: `kuroicode@gmail.com`, `phumphum80@gmail.com`
- `users`: `두연`, `유선`
- `couples`: `23uQLvKxuVe1mmtwxwTzSDfXEDI2_6xcREXYFS2WqP1pavVEaYxEm7bi1`
- `invites`: 0개

⚠️ 미완료 항목:
- Storage의 오래된 테스트 파일 정리는 별도 요청 시 수행 가능

## 05. 특이점 / 결정사항
- Auth에는 2명만 남았지만 Firestore에는 E2E 테스트 사용자 문서가 100개 이상 남아 있었다.
- 관리자 페이지의 과다 회원 표시 원인은 Firestore `users` 잔여 문서였다.
- 실제 커플 문서 하나를 제외한 테스트 커플 문서는 하위 컬렉션 포함 재귀 삭제했다.

## 06. 남은 작업
- [ ] 관리자 페이지에서 회원 목록이 2명만 표시되는지 실확인 (담당: 소장님)
- [ ] 필요 시 Storage 테스트 파일 정리 (담당: Codex)

## 07. 핸드오프 메모
- Cursor에게: 회원 목록은 Firestore `users` 기준이므로 E2E 실행 후 cleanup 실패 시 다시 늘어날 수 있다.
- Codex에게: 실사용자 UID는 `23uQLvKxuVe1mmtwxwTzSDfXEDI2`, `6xcREXYFS2WqP1pavVEaYxEm7bi1`이다.
- 주의사항: 운영 데이터 정리 시 실제 coupleId `23uQLvKxuVe1mmtwxwTzSDfXEDI2_6xcREXYFS2WqP1pavVEaYxEm7bi1`는 삭제 금지.

## 08. Git 커밋
- 커밋 해시: 커밋 후 확인
- 배포 여부: 코드 변경 없음
