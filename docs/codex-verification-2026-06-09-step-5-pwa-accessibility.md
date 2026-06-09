# Codex Verification Report — Step 5 PWA 알림·접근성 안정화

- 검증일: 2026-06-09
- 대상: Step 5 — PWA 알림·접근성 안정화
- 결과: 수정 후 통과
- 보고 위치: Notion 미기록, 프로젝트 `docs/` 저장

## 01. 검증 요약

Step 5 구현은 PWA 알림, iOS push gate, font scale bootstrap, safe-area, 50px 터치 타겟, 채팅 고대비 보강 방향으로 반영되어 있었다.

확인한 항목:

- Service Worker notification click에서 React 라우팅 메시지 전송
- `App.tsx`에서 `NAVIGATE` / `PLAY_NOTIFICATION_SOUND` 메시지 처리
- 잠금 상태에서 notification navigation을 pending으로 저장하는 흐름
- foreground visible/hidden 알림 분기
- iOS Safari tab에서 push permission 요청 차단
- `bootstrapFontScale()` 부트 시 실행
- safe-area 및 50px 터치 타겟 스타일 반영

다만 딥링크 타이밍과 unlock 후 이동 흐름에서 실제 버그가 있어 수정했다.

## 02. 발견 이슈 및 수정

### P1 — 알림 수신 시점에 화면 이동이 예약됨

- 영향 파일: `public/firebase-messaging-sw.js`
- 원인:
  - `onBackgroundMessage`에서 알림 클릭 전에도 client에 `NAVIGATE` 메시지를 전송했다.
- 영향:
  - 사용자가 알림을 누르지 않았는데도 앱 화면 이동이 발생하거나 pending navigation이 저장될 수 있음
- 수정:
  - background message 수신 시점에는 sound message만 전송
  - `NAVIGATE`는 `notificationclick` 이벤트에서만 전송

### P1 — 잠금 해제 후 pending navigation이 `home`으로 덮일 수 있음

- 영향 파일: `src/App.tsx`
- 원인:
  - `connected` session sync effect가 `unlocked` 상태에서 항상 `setScreen('home')`을 호출했다.
- 영향:
  - 알림 클릭 → 잠금 화면 → unlock → 대상 화면 이동 직후 `home`으로 튕길 수 있음
- 수정:
  - connected effect는 AppContext `connect()`만 수행
  - unlock 시 pending navigation 또는 URL `screen` query를 우선 처리

### P2 — foreground hidden system notification 클릭 시 딥링크 미적용

- 영향 파일:
  - `src/lib/notificationAlert.ts`
  - `src/App.tsx`
- 원인:
  - 앱 foreground handler가 hidden 상태에서 직접 생성한 `Notification`은 클릭 시 `window.focus()`만 수행했다.
- 영향:
  - SW 알림은 딥링크가 되지만, 앱 쪽 system notification은 대상 화면으로 이동하지 않을 수 있음
- 수정:
  - `showSystemNotification()`에 `onClick` callback 추가
  - hidden notification 클릭 시 `requestNavigation(target)` 실행

### P2 — 알림 screen 값 검증 부재

- 영향 파일: `src/App.tsx`
- 원인:
  - 외부 notification payload의 `screen` 값을 곧바로 `Screen`으로 캐스팅했다.
- 영향:
  - 잘못된 screen 값으로 빈 화면 상태가 될 수 있음
- 수정:
  - 허용 가능한 screen set을 추가
  - 알 수 없는 screen 값은 무시

## 03. 검증 결과

- `npm.cmd run build`: 통과
- 로컬 브라우저 스모크 테스트: 통과
  - URL: `http://127.0.0.1:5173/`
  - 첫 화면 렌더 확인
  - 콘솔 error 0건

## 04. 미검증 항목

실기기/브라우저 권한이 필요한 항목은 이번 검증에서 직접 수행하지 않았다.

- Android PWA notification click 딥링크
- iOS standalone PWA push permission gate
- iOS Safari tab push permission 차단 UI
- safe-area 실제 노치/홈 인디케이터 대응
- FCM 실제 foreground/hidden/background 수신 분기

## 05. 남은 작업

- [ ] Step 3 backlog: `firebase deploy --only firestore:rules,storage`
- [ ] 배포 후 live E2E
- [ ] Android 실기기 PWA 알림 클릭 QA
- [ ] iOS Safari / standalone PWA push gate QA
- [ ] safe-area / 50px 터치 타겟 실기기 QA
- [ ] Git 커밋 및 푸시

## 06. 결론

Step 5는 Codex 수정 후 build 및 로컬 스모크 기준 통과 상태다. 실제 PWA 알림과 iOS gate는 실기기 QA가 필요하다.

Codex 설계분석 체크리스트 확인 완료
