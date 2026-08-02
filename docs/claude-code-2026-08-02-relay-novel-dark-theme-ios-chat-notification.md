# ✅ 완료 보고서 — 릴레이소설 · 다크모드 · iOS 채팅 입력 · 알림 근본 수정 (Claude Code, 2026.08.02)

원본 작업지시문: 소장님 직접 요청 (세션 중 순차 지시)
기준 커밋: `8a0d9fc`
작업 브랜치: `claude/chat-caption-ios-kb` → `main` (fast-forward 반영 완료)
최종 커밋: `7a9724d`

---

## 01. 작업 요약

- 목표: 채팅 첨부 캡션 → iOS 채팅 입력 문제 → 사이드카 단축키 → 다크모드 → 릴레이소설 → 알림 미수신
- 결과: **완료** (실기기 확인이 남은 항목 2건은 06장에 명시)
- 앱 버전: v0.6.1 → **v0.14.1** / 사이드카: v0.2.0 → **v0.3.2**
- 커밋 17개, 34개 파일, +2,946 / −109

---

## 02. 구현 항목

### 2-1. 채팅 첨부 캡션 (v0.7.0)
첨부 확인 시트에 선택 입력 캡션란 추가. 여러 파일을 한 번에 보내면 파일마다 따로 입력받는다. 사진·음악·문서 모두 지원하며 푸시 본문에도 캡션이 표시된다.

### 2-2. iOS 채팅 입력 (v0.7.0 → v0.11.0)
세 번 고쳐서야 잡혔다. 앞의 두 번은 **키보드 높이를 계산해 입력 바를 띄우는 접근** 자체가 원인이었다.

| 버전 | 증상 | 원인 |
|---|---|---|
| v0.7.0 | 전송 시 키보드가 내려갔다 올라옴 | 전송 직후 버튼이 `disabled`가 되며 iOS가 포커스를 해제 |
| v0.7.1 | 화면이 위아래로 진동 | `window.scrollTo(0,0)`로 iOS의 스크롤을 되돌리며 힘겨루기 |
| v0.7.2 | 최근 메시지가 가려짐 | iOS 두 동작 모드(PWA=레이아웃 축소 / 사파리=유지) 중 하나만 처리 |
| v0.11.0 | 전송 후 입력창만 내려감 | 인셋 계산에 `vv.offsetTop`이 섞여, 포커스 복원 시 값이 줄어듦 |

**최종 해결**: 계산을 없앴다. 채팅 화면을 `position: fixed`로 보이는 영역(`--vv-height`/`--vv-top`)에 직접 고정하고, 입력 바를 그 안의 일반 흐름 요소로 전환. 되먹임 경로 자체가 사라졌다.

### 2-3. 다크모드 (v0.9.0)
기존 고대비(노랑/검정)는 저시력용으로 유지하고 편안한 다크 테마를 세 번째로 추가. 설정의 테마 선택을 3개 카드로 개편하고 텍스트 라벨을 병기(색상만으로 구분하지 않음).

`[data-theme="dark"]`가 `:root`와 특이도가 같아 일부 요소에 밝은 값이 남던 문제를 `html[data-theme="dark"]`로 해결.

### 2-4. 릴레이소설 (v0.12.0 → v0.13.3)
채팅에서 둘이 한 턴씩 주고받으며 소설을 쓰는 기능. 홈에 서재 메뉴 신설.

- 명령: `시작` `쓰기` `끝` `완결` `도움` `제목` `배경` `초기화`, 축약 `/릴소`
- **슬래시 명령만 처리** — 초기 구현은 세션 중 일반 대화를 턴으로 기록하는 문제가 있었다
- 한 턴씩 교대, 상단에 차례 표시. `끝`·`도움`은 차례인 사람만
- 제목·배경은 둘 다 언제든 추가·삭제. 배경은 이어쓰기 도움에 함께 전달
- `초기화`는 둘 다 입력해야 실행되고 세션까지 닫는다
- 완결본은 서재에서 열람·문서(.md) 저장

**DeepSeek 연동**: API 키가 번들에 노출되지 않도록 Cloud Function(`relayNovelAssist`) 경유. 키는 `functions/.env`(gitignore). 호출자가 해당 커플 구성원인지 서버에서 검증.

### 2-5. 사이드카 단축키 · PIN (v0.8.0 → v0.10.0, 사이드카 0.3.x)
- `Win+Alt+Q`로 어디서든 채팅 열기. 네이티브 모듈 없이 PowerShell + Win32 `RegisterHotKey`
- 단일 인스턴스 판정을 PID 파일 → **포트 바인딩**으로 교체 (옛 버전이 남아 새 버전이 뜨지 못하던 문제)
- 지정 계정(`isPinFreeEmail`)은 PIN 생략 — 소장님 지시

### 2-6. 알림 근본 수정 (v0.14.0 → v0.14.1)
**세 겹으로 막혀 있었다.** 배포본을 직접 열어보고 찾았다.

| # | 원인 | 조치 |
|---|---|---|
| 1 | 두 사용자 모두 `notificationSettings.message = false` | 값 복구 + 아래 2번으로 재발 차단 |
| 2 | 알림 설정이 localStorage에만 있어, 오래된 로컬값을 가진 기기에서 알림음만 바꿔도 전체 설정이 서버에 덮어써짐 | 서버를 원본으로 전환(`syncSettingsFromServer`) |
| 3 | 배포된 `firebase-messaging-sw.js`에 `__VITE_FIREBASE_*__` 플레이스홀더가 그대로 남아 SW가 FCM 초기화 실패 | 치환을 빌드 마지막 단계로 분리, 남으면 **빌드 실패** |
| 4 | notification 페이로드가 있으면 `showNotification`을 호출하지 않고 조기 반환 — iOS PWA는 자동 표시가 없어 앱이 닫히면 아무것도 안 뜸 | 항상 SW가 표시하도록 경로 통합 |

**중요**: 1번은 [2026-07-21 보고서](claude-code-2026-07-21-push-stability-sidecar-pin-keyboard.md)에서 이미 한 번 발견된 원인이다. 그때는 **값만 되돌리고 왜 꺼지는지는 고치지 않아** 재발했다. 이번에 2번(설정 소유권)을 고쳐 재발 경로를 끊었다.

---

## 03. 변경된 파일 (주요)

| 파일 | 변경 내용 |
|---|---|
| `src/hooks/useKeyboardInset.ts` | 신규 — visualViewport 추적, `--vv-height`/`--vv-top` 노출 |
| `src/screens/ChatScreen.tsx` | 보이는 영역 고정, 릴레이소설 명령 처리 |
| `src/components/ChatInput.tsx` | 캡션 입력, 입력 바를 흐름 요소로 전환 |
| `src/lib/relayNovel.ts` · `src/hooks/useRelayNovel.ts` | 신규 — 명령 파싱, 세션 상태 |
| `src/screens/RelayNovelScreen.tsx` · `src/components/RelayNovel*.tsx` | 신규 — 서재, 진행 띠, 설정 시트 |
| `src/hooks/usePushNotification.ts` | `syncSettingsFromServer` 추가 |
| `public/firebase-messaging-sw.js` | 조기 반환 제거, 항상 표시 |
| `scripts/inject-sw-env.mjs` | 신규 — SW 설정 주입, 누락 시 빌드 실패 |
| `functions/src/index.ts` | `relayNovelAssist` 신규, 캡션 푸시 본문 |
| `sidecar/*` | 전역 단축키, 포트 기반 단일 인스턴스, PIN 우회 토큰 |
| `firestore.rules` · `firestore.indexes.json` | relayNovels 규칙 + 복합 인덱스 |

---

## 04. 검증

| 대상 | 방법 | 결과 |
|---|---|---|
| 릴레이소설 명령 파서 | `scripts/test-relay-command.ts` | 35/35 |
| 턴 규칙 · 초기화 합의 | `scripts/test-relay-turns.ts` | 32/32 |
| Firestore 데이터 흐름 | `scripts/test-relay-firestore.mjs` (실제 DB, 자동 정리) | 26/26 |
| DeepSeek 이어쓰기 | 동일 프롬프트 5회 연속 | 5/5, 2~3문장 규칙 준수 |
| 다크 테마 대비 | 브라우저 실측 | 본문 15.6:1, 보조 9.2:1 — 전 항목 AA 통과 |
| iOS 레이아웃 | 5개 시나리오 좌표 측정 | 전부 입력 바 = 화면 바닥 |
| 푸시 발송 | 실제 FCM 발송 | 토큰 4/4 성공, 유선님 아이폰 수신 확인 |
| 라이브 배포본 | 번들·SW 직접 fetch | 설정 주입·신규 코드 확인, API 키 미노출 |

---

## 05. 특이점 / 사고 기록

세션 초반에 **운영 사고 2건**이 있었다. 모두 복구했으나 기록해 둔다.

1. **옛 기준 브랜치에서 배포** — 워크트리 브랜치가 main보다 72커밋 뒤처진 상태였는데 확인 없이 배포해 라이브를 v0.6.1 → v0.3.0으로 되돌렸다.
2. **`.env` 누락 빌드 배포** — 워크트리에 `.env`가 없어 Firebase 설정이 `undefined`인 번들이 나갔고, 전 플랫폼 백지 화면이 됐다. 되돌린다고 올린 재배포도 같은 문제를 반복했다.

**재발 방지로 정착시킨 것**: 배포 전 번들에 설정이 주입됐는지 검사, 배포 후 실제 URL을 열어 확인. SW 설정 누락은 이제 빌드가 실패한다.

---

## 06. 남은 작업

- [ ] **아이폰 채팅 입력 실기기 확인** (v0.11.0) — 전송 후 입력창이 키보드 위에 유지되는지 (담당: 소장님)
- [ ] **릴레이소설 화면 조작 확인** — `/릴소 시작` → `쓰기` → `도움` → `완결` → 서재 (담당: 소장님)
- [ ] 소장님 기기 알림 수신 확인 (유선님 기기는 확인 완료)
- [ ] `package.json` 버전(0.5.12)과 `APP_VERSION`(0.14.1) 불일치 정리 (담당: Cursor)
- [ ] (선택) 서비스 계정 키 발급 시 로그인 E2E 자동화 가능

---

## 07. 핸드오프 메모

- **Cursor에게**: 릴레이소설 UI는 `relay-*` 클래스로 분리돼 있다. 다크·고대비 오버라이드가 함께 있으니 스타일 수정 시 세 테마 모두 확인할 것.
- **Codex에게**: 검증 스크립트 3종이 있다. `test-relay-firestore.mjs`는 실제 DB에 쓰고 지우므로 운영 데이터가 있는 시간대에는 주의.
- **주의**: `functions/.env`(DeepSeek 키)는 gitignore 대상이라 저장소에 없다. 다른 환경에서 Functions를 배포하려면 별도 설정이 필요하다.
- **보안 관련 결정**: `isPinFreeEmail`로 지정 계정은 PIN을 생략한다. 해당 계정의 모든 기기(아이폰 포함)에 적용된다.

---

## 08. Git

- 최종 커밋: `7a9724d`
- 브랜치: `claude/chat-caption-ios-kb` = `main` (동일)
- 리뷰용 PR: https://github.com/kuroicode-beep/tether/pull/1 (base: `review-base/session-2026-08-02`, **머지 금지**)
- 배포: https://tether-d1dab.web.app (v0.14.1), Functions `relayNovelAssist`·`onNewMessage`, Firestore rules·indexes
