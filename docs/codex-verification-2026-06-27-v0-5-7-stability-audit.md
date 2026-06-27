제목: ✅ Codex 검증 보고서 — v0.5.7 안정성/알림/UI 점검 (2026.06.27)
원본 작업지시문:
- 전체 점검, 알림 안정화, 버그 수정, UI 편의성 강화

## 01. 작업 요약
- 목표: 최신 `main` 기준으로 앱 빌드, Functions 빌드, rules 컴파일, 알림/플레이어/고대비 주요 경로를 재점검한다.
- 결과: 부분통과
- 소요 시간: 약 20분

## 02. 작업 로그
- [2026.06.27] 현재 워크트리와 최근 커밋 확인
- [2026.06.27] 알림 Service Worker, foreground notification, notification sound 경로 확인
- [2026.06.27] 같이듣기 플레이어 상태 저장/랜덤 반복 경로 확인
- [2026.06.27] 고대비 관련 주요 CSS 패턴 검색
- [2026.06.27] `npm run build` 실행
- [2026.06.27] `npm --prefix functions run build` 실행
- [2026.06.27] `firebase deploy --only firestore:rules,storage --dry-run` 실행
- [2026.06.27] `npm run lint` 실행 및 실패 원인 확인

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `docs/codex-verification-2026-06-27-v0-5-7-stability-audit.md` | 안정성 점검 보고서 추가 | 본 문서 |

## 04. 구현 결과
✅ 완료 항목:
- `npm run build` 통과
- `npm --prefix functions run build` 통과
- `firebase deploy --only firestore:rules,storage --dry-run` 통과
- `public/firebase-messaging-sw.js`에서 보이는 창이 있을 때 시스템 알림 대신 내부 메시지를 보내는 경로 확인
- `src/App.tsx`에서 SW 메시지와 foreground FCM 메시지에 `shouldHandleNotification()` 중복 방지 경로가 적용되어 있음을 확인
- `src/components/ThemeMusicPlayer.tsx`에서 숨김 상태와 재생 상태가 분리되어 있음을 확인
- 고대비 전역 보정(`hc-readable-box`, high-contrast token overrides)이 존재함을 확인

⚠️ 미완료 항목:
- `npm run lint` 실패: `eslint` 실행 파일과 ESLint 설정이 현재 프로젝트에 없다.
- 실제 PC/iOS/Android 알림 수신, PWA 표시 상태, 오디오 자동재생 정책은 실기기 확인이 필요하다.
- live Firebase E2E는 `docs/codex-verification-2026-06-25-google-only-signup.md`에 기록된 것처럼 기존 익명 Auth 기반 테스트와 현재 Google 전용 가입 정책이 충돌할 수 있어 이번 점검에서는 실행하지 않았다.

## 05. 특이점 / 결정사항
- 현재 검증 가능한 자동 게이트 중 클라이언트 빌드, Functions 빌드, Firestore/Storage rules 컴파일은 통과했다.
- lint 스크립트는 존재하지만 실제 의존성과 설정이 없어 검증 게이트로 동작하지 않는다. 다음 안정화 작업에서 ESLint 도입 또는 lint 스크립트 정정이 필요하다.
- 알림 중복 문제는 `notificationId` 기반 중복 제거와 SW visible window 분기가 핵심 방어선이다. 재발 시 Functions payload의 `notificationId` 포함 여부부터 확인해야 한다.

## 06. 남은 작업
- [ ] ESLint 의존성/설정 추가 또는 `lint` 스크립트 정책 재정의 (담당: Codex/Cursor)
- [ ] 실기기 PC/Android/iOS 알림 시나리오 확인 (담당: 소장님)
- [ ] Google 전용 가입 정책에 맞춘 live E2E 테스트 재작성 (담당: Codex/Cursor)

## 07. 핸드오프 메모
- Cursor에게: `npm run lint`가 현재 죽는 상태다. 단순히 lint 통과라고 보고하면 안 된다.
- Codex에게: 전체 완료 판정은 아직 불가하다. 자동 빌드/규칙 컴파일은 통과했지만 lint와 실기기 알림 검증, Google 전용 E2E 정비가 남아 있다.
- 주의사항: 기존 dirty/untracked 파일은 이번 점검 범위 밖이라 수정하지 않았다.

## 08. Git 커밋
- 커밋 해시: final 응답 기준 기재
- 배포 여부: 앱 코드 변경 없음, 배포 불필요
