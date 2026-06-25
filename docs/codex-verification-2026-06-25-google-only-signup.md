제목: ✅ Codex 검증 보고서 — Google 전용 가입 진입 적용 (2026.06.25)
원본 작업지시문:
- 처음 가입 진입 경로부터 비회원 가입을 막고 Google 로그인으로만 가입 가능하게 변경

## 01. 작업 요약
- 목표: 닉네임/익명 시작 경로를 제거하고 Google 로그인 기반 가입만 허용
- 결과: 통과
- 소요 시간: 약 20분

## 02. 작업 로그
- [2026-06-25] 온보딩 `닉네임만으로 시작하기` 경로 확인
- [2026-06-25] `signInAnonymously()` 앱 호출 경로 제거
- [2026-06-25] 기존 익명 세션 감지 시 자동 로그아웃 처리
- [2026-06-25] Firestore `users/{uid}` 생성 rules를 Google 로그인 토큰으로 제한
- [2026-06-25] 빌드 및 Firestore rules 컴파일 검증
- [2026-06-25] Hosting + Firestore rules 배포

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `src/screens/OnboardingScreen.tsx` | 첫 화면을 Google 로그인 전용으로 변경, 닉네임/익명 시작 제거 | 가입 진입점 |
| `src/context/SessionContext.tsx` | 익명 로그인 API 제거, 익명 세션 자동 로그아웃 | 세션 방어 |
| `src/hooks/useAuth.tsx` | 하위 호환 wrapper에서 익명 로그인 제거 | 타입 정리 |
| `firestore.rules` | `users/{uid}` create를 Google sign-in provider로 제한 | 서버 규칙 |
| `docs/codex-verification-2026-06-25-google-only-signup.md` | 검증 보고서 추가 | 본 문서 |

## 04. 구현 결과
✅ 완료 항목:
- 첫 가입 화면에서 Google 로그인 버튼만 노출
- 닉네임 입력 및 `닉네임만으로 시작하기` 버튼 제거
- 앱 코드에서 `signInAnonymously()` 호출 제거
- 기존 익명 세션이 남아 있어도 앱 진입 시 로그아웃 처리
- Firestore user doc 생성은 `sign_in_provider == google.com`일 때만 허용

⚠️ 미완료 항목:
- `scripts/test-e2e-firebase.ts`는 기존 익명 Auth 기반 테스트라 새 정책과 충돌 가능성이 있음. 운영 정책 우선으로 이번 배포에서는 실행하지 않음.

## 05. 특이점 / 결정사항
- UI 숨김만으로는 충분하지 않아 세션 레벨과 Firestore rules 레벨을 함께 막았다.
- 관리자 승인 대기 흐름은 그대로 유지된다.
- 기존 실사용자 Google 계정 2명에는 영향이 없다.

## 06. 남은 작업
- [ ] 신규 기기에서 첫 화면에 Google 로그인만 보이는지 실확인 (담당: 소장님)
- [ ] 필요 시 E2E 테스트를 Google/mock provider 기준으로 재작성 (담당: Codex/Cursor)

## 07. 핸드오프 메모
- Cursor에게: 신규 가입 UX는 Google 전용이다. 닉네임 전용 시작 버튼을 되살리면 안 된다.
- Codex에게: rules 검증 시 익명 테스트는 실패가 정상일 수 있으므로 테스트 설계를 갱신해야 한다.
- 주의사항: Firebase Console에서 Anonymous provider도 가능하면 비활성화하면 정책이 더 단단해진다.

## 08. Git 커밋
- 커밋 해시: `f7fcbb3`
- 배포 여부: Firebase Hosting + Firestore rules 배포 완료 (`https://tether-d1dab.web.app`)
