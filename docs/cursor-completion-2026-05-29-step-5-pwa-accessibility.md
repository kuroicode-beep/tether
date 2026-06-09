# ✅ 완료 보고서 — Tether 안정화 Step 5 (PWA/알림/UI 접근성, Cursor, 2026.05.29)

원본 작업지시문: `docs/implementation-work-instructions-2026-06-09.md` §Step 5  
기준 커밋: `57a7e75`  
작업 브랜치: `main`

## 01. 작업 요약

- 목표: PWA 알림 딥링크, foreground 중복 알림 제거, iOS push gate, font scale bootstrap, safe-area·고대비·줄바꿈·터치 타겟(50px) 안정화
- 결과: 완료
- 배포 여부: 미배포 (코드만 반영, `npm run build` 통과)

## 02. 작업 로그

- SW `NAVIGATE` postMessage + `App.tsx` 핸들러 + 잠금 시 pending navigation
- Foreground FCM: visible → toast+sound만, hidden → system notification
- `canRequestPushPermission()`을 배너/온보딩/설정/`requestAndSavePushToken`에 연결
- `bootstrapFontScale()`을 `main.tsx` 부트 시 실행
- `tokens.css` safe-area, 50px 터치, 말풍선 width dedup, URL `overflow-wrap: anywhere`
- Home/BottomNav/ChatInput/ImageViewer/PIN 패드 UI 보강

## 03. 변경된 파일

| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `public/firebase-messaging-sw.js` | 알림 클릭·백그라운드 시 `NAVIGATE` postMessage | screen 쿼리 추출 |
| `src/App.tsx` | SW 메시지 라우팅, pending nav, foreground dedup | |
| `src/lib/notificationAlert.ts` | `SW_NAVIGATE_MESSAGE`, visible 시 system notification 스킵 | |
| `src/hooks/usePushNotification.ts` | `canRequestPushPermission()` gate | iOS Safari 탭 차단 |
| `src/hooks/useFontScale.ts` | `bootstrapFontScale()` export | |
| `src/main.tsx` | 부트 시 font scale 적용 | |
| `src/components/PushPermissionBanner.tsx` | iOS gate | |
| `src/screens/OnboardingScreen.tsx` | push sheet iOS gate | |
| `src/screens/SettingsScreen.tsx` | push 요청·토글 50px | |
| `src/styles/tokens.css` | safe-area, 50px, bubble, high-contrast | |
| `src/components/BottomNav.tsx` | safe-area class, 50px 버튼 | |
| `src/screens/HomeScreen.tsx` | home-header safe-area, status card HC class | |
| `src/components/ImageViewer.tsx` | close 버튼 safe-area 50px | |

## 04. 구현 결과

### ✅ 완료 항목

- Notification click → `postMessage({ type: 'NAVIGATE', screen })` + React 라우팅
- 잠금 화면에서 알림 클릭 시 unlock 후 대상 화면 이동
- Foreground visible: toast + sound만 (시스템 알림 없음)
- Foreground hidden: system notification
- iOS Safari 탭: push permission 요청 차단 (standalone PWA만 허용)
- Font scale 앱 시작 시 localStorage 반영
- Chat/Home header, BottomNav, ChatInput, ImageViewer close safe-area
- 채팅 bubble `word-break: keep-all` + URL `overflow-wrap: anywhere`
- 말풍선 max-width 중복 제거 (message-row 직계 자식에만 68%)
- BottomNav/채팅 버튼/PIN/설정 토글 min 50px

### ⚠️ 미완료 항목

- 실기기 QA (Android/iOS PWA 알림·safe-area) — 소장님 검증 필요
- Step 3 backlog: `firebase deploy --only firestore:rules,storage` + live E2E

## 05. 검증 결과

- `npm run build`: ✅ 통과 (tsc + vite build)
- `npm run test:rules`: 미실행 (Step 3 rules deploy 대기)
- 실기기 QA: 미실행

## 06. 특이점 / 결정사항

- Foreground `willAlert` false여도 visible이면 toast만 표시 (알림 설정 off 시에도 인앱 피드백 유지)
- `--bottom-nav-height`에 safe-area-inset-bottom 포함해 FAB/입력창 오프셋 일관성 유지
- iOS 설치 안내는 기존 `IOSInstallBanner`가 담당; push gate는 permission flow만 차단

## 07. 남은 작업

- [ ] Step 5 커밋·push (담당: 소장님 승인 시 Cursor)
- [ ] Firestore/Storage rules 배포 + live E2E (담당: Cursor/소장님)
- [ ] Step 6 최종 검증·배포 판정 (담당: Codex + 소장님)
- [ ] Android/iOS 실기기 알림·safe-area QA (담당: 소장님)

## 08. 핸드오프 메모

- Codex에게: foreground dedup 분기, iOS `canRequestPushPermission` 모든 진입점 연결, SW NAVIGATE + pending unlock 흐름 검증 요청
- 다음 작업: Step 6 — `npm run build`, rules deploy, 실기기 체크리스트
- 주의사항: `firebase-messaging-sw.js`는 빌드 시 Vite env 치환 필요 — 배포 후 SW 갱신 확인

## 09. Git

- 커밋 해시: `ae91852`
- push 여부: 예 (`origin/main`)
- 배포 여부: Step 6에서 hosting 배포 예정

권장 커밋 메시지:

```text
Stabilize PWA notifications, safe areas, and high contrast chat UI.
```
