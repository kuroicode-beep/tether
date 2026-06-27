제목: ✅ Codex 검증 보고서 — v0.5.10 Google 전용 E2E 재정비 (2026.06.27)
원본 작업지시문:
- 전체 점검, 알림 안정화, 버그 수정, UI 편의성 강화

## 01. 작업 요약
- 목표: Google 전용 가입 정책 이후 기존 익명 Auth 기반 live E2E가 깨진 문제를 수정한다.
- 결과: 부분통과
- 소요 시간: 약 35분

## 02. 작업 로그
- [2026.06.27] 기존 `scripts/test-e2e-firebase.ts`의 `signInAnonymously`/client user create 의존 확인
- [2026.06.27] Admin SDK 기반 테스트 사용자 시드 방식으로 전환
- [2026.06.27] custom token 로그인 후 운영 권한/공유/차단 rules 검증 흐름 유지
- [2026.06.27] 비-Google/custom auth의 `users/{uid}` create 거부 테스트 추가
- [2026.06.27] Admin SDK cleanup 보강
- [2026.06.27] `npm run test:e2e:firebase` 스크립트 추가
- [2026.06.27] Admin credential 미설정 시 명확한 환경변수 안내 추가
- [2026.06.27] v0.5.10 버전/Log 반영

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `scripts/test-e2e-firebase.ts` | 익명 Auth 제거, Admin SDK seed + custom token 방식으로 재작성 | live E2E |
| `package.json` | `test:e2e:firebase` 스크립트 및 `firebase-admin`, `tsx` devDependency 추가 | 검증 명령 |
| `package-lock.json` | 의존성 잠금 갱신 | 검증 환경 |
| `src/lib/appVersion.ts` | 앱 버전 `0.5.10` 반영 | 단일 버전 소스 |
| `src/screens/ReleaseLogScreen.tsx` | v0.5.10 핫픽스 로그 추가 | 앱 내 Log |
| `docs/codex-verification-2026-06-27-v0-5-10-google-e2e-admin-seed.md` | 검증 보고서 추가 | 본 문서 |

## 04. 구현 결과
✅ 완료 항목:
- 기존 `signInAnonymously` 제거
- 테스트 user doc 생성은 Admin SDK seed로 전환
- 클라이언트 권한 검증은 custom token 로그인으로 유지
- `non-google user doc create` 거부 테스트 추가
- cleanup을 Admin SDK 기준으로 보강해 status/statusHistory/couple doc 찌꺼기 제거 가능하게 수정
- `npm run test:e2e:firebase` 명령 추가
- Admin credential이 없을 때 필요한 환경변수를 명확히 안내
- `npm run lint` 통과
- `npm run build` 통과
- `npm --prefix functions run build` 통과
- `firebase deploy --only firestore:rules,storage --dry-run` 통과

⚠️ 미완료 항목:
- live E2E 실제 통과는 미확인. 현재 로컬에 Firebase Admin credential이 없어 `npm run test:e2e:firebase`는 의도대로 credential 안내 후 종료된다.
- `firebase-admin` 추가로 moderate audit 경고 6건이 발생한다. `npm audit --audit-level=high`는 통과하지만, moderate 해결은 현재 `npm audit fix --force`가 `firebase-admin@10.3.0` breaking downgrade를 요구해 보류했다.

## 05. 특이점 / 결정사항
- Google OAuth UI를 자동 E2E에서 직접 수행하는 대신, 운영 가입 완료 후 존재하는 user doc 상태를 Admin SDK로 시드한다.
- 이 방식은 `users/{uid}` create가 Google provider만 허용되는 정책을 유지하면서, 커플 연결 후 권한 모델을 live Firebase에서 검증할 수 있다.
- live E2E 실행에는 아래 중 하나가 필요하다:
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
  - `FIREBASE_SERVICE_ACCOUNT_BASE64`
  - `FIREBASE_SERVICE_ACCOUNT_PATH`
  - `GOOGLE_APPLICATION_CREDENTIALS`

## 06. 남은 작업
- [ ] 서비스 계정 환경변수 설정 후 `npm run test:e2e:firebase` 재실행 (담당: Codex/소장님)
- [ ] PC/iOS/Android 알림 실기기 확인 (담당: 소장님)
- [ ] `firebase-admin` moderate audit 해결 가능한 상위 버전 공개 시 재점검 (담당: Codex/Cursor)

## 07. 핸드오프 메모
- Cursor에게: live E2E는 더 이상 익명 가입을 쓰면 안 된다. user doc은 Admin SDK seed가 맞다.
- Codex에게: 이 스크립트는 credential 없이는 실패하는 것이 정상이다. 실패 메시지가 credential 안내인지 먼저 확인할 것.
- 주의사항: `npm audit fix --force`는 firebase-admin breaking downgrade를 제안하므로 임의 실행 금지.

## 08. Git 커밋
- 커밋 해시: final 응답 기준 기재
- 배포 여부: Firebase Hosting 배포 예정
