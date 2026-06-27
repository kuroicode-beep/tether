# Tether 완료보고서 인덱스

작성일: 2026-06-28  
기준 버전: v0.5.10

## 01. 문서 위치

프로젝트 완료보고서와 검증보고서는 모두 로컬 저장소 `C:\Projects\tether\docs`에 Markdown으로 저장한다.

Notion에는 기록하지 않는다.

## 02. 핵심 규칙

- Cursor 완료보고서: `docs/cursor-completion-YYYY-MM-DD-[작업명].md`
- Codex 검증보고서: `docs/codex-verification-YYYY-MM-DD-[작업명].md`
- 검증보고서와 완료보고서는 다음 에이전트가 컨텍스트 없이 이어받을 수 있게 작성한다.
- 미완료 항목과 이유를 반드시 기록한다.

## 03. 주요 완료보고서

### 초기 안정화

- `cursor-completion-2026-05-29-step-2-read-badge.md`
- `cursor-completion-2026-05-29-step-3-firestore-ownership.md`
- `cursor-completion-2026-05-29-step-4-optimistic-sync.md`
- `cursor-completion-2026-05-29-step-5-pwa-accessibility.md`
- `cursor-completion-2026-05-29-step-6-final-verification.md`

### v0.2.0

- `cursor-completion-2026-06-12-v0-2-0-release.md`
- `spec-tether-v0.2.0.md`

### v0.3.0

- `cursor-completion-2026-06-25-v0-3-0-step-1-feedback-sync.md`
- `cursor-completion-2026-06-25-v0-3-0-steps-3-6.md`
- `codex-verification-2026-06-25-v0-3-0-feedback-sync.md`
- `codex-verification-2026-06-25-v0-3-0-final.md`

### v0.4.x

- `codex-verification-2026-06-25-v0-4-0-update.md`
- `codex-verification-2026-06-25-v0-4-1-separate-menus.md`
- `codex-verification-2026-06-25-v0-4-2-partner-nickname-status-tags.md`
- `codex-verification-2026-06-25-v0-4-3-notification-sounds-docs.md`
- `cursor-completion-2026-06-25-v0-4-3-final.md`
- `codex-verification-2026-06-26-v0-4-8-pc-notification-dedupe-hotfix.md`
- `codex-verification-2026-06-26-v0-4-12-library-theme-music-button-hotfix.md`

### v0.5.x

- `codex-verification-2026-06-26-v0-5-0-listen-together.md`
- `codex-verification-2026-06-26-v0-5-1-notification-focus-hotfix.md`
- `codex-verification-2026-06-26-v0-5-2-library-listen-split.md`
- `codex-verification-2026-06-26-v0-5-3-library-file-index-listen-picker.md`
- `codex-verification-2026-06-26-v0-5-3-library-live-backfill.md`
- `codex-verification-2026-06-26-v0-5-4-listen-refresh-player.md`
- `codex-verification-2026-06-26-v0-5-5-random-repeat-player.md`
- `codex-verification-2026-06-26-v0-5-6-player-random-start-hidden-audio.md`
- `codex-verification-2026-06-27-v0-5-7-stability-audit.md`
- `codex-verification-2026-06-27-v0-5-8-lint-audit-gate.md`
- `codex-verification-2026-06-27-v0-5-9-fast-refresh-cleanup.md`
- `codex-verification-2026-06-27-v0-5-10-google-e2e-admin-seed.md`

## 04. 검색 키워드

- 세션/복구: `SessionContext`, `restore_failed`, `Google recovery`
- 알림: `push`, `FCM`, `firebase-messaging-sw`, `iOS PWA`
- 접근성: `high contrast`, `hc-readable-box`, `고대비`
- 자료실: `useLibrary`, `files index`, `backfill`
- 같이듣기: `useListeningTogether`, `ThemeMusicPlayer`, `random repeat`
- Log 리포트: `feedbackReports`, `ReleaseLogScreen`
- 검증 게이트: `eslint.config.js`, `npm run lint`, `test:e2e:firebase`
- Google-only E2E: `firebase-admin`, `custom token`, `FIREBASE_SERVICE_ACCOUNT_PATH`
