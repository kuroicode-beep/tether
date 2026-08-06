## 대상
- 프로젝트: Tether (커플 전용 PWA)
- 작업 폴더: `C:\Projects\tether` (실제 편집은 워크트리 `C:\Projects\tether\.claude\worktrees\nice-perlman-101d1d`에서 했고, main에 fast-forward 반영 + 메인 repo까지 pull 완료)
- 세션 시각: 2026-08-02 23:20 (KST)

## 세션 요약
소장님의 순차 지시로 Tether를 v0.6.1 → **v0.14.1**까지 올렸다. 채팅 첨부 캡션 → iOS 채팅 입력 문제(3회 시도) → 사이드카 전역 단축키 → 다크모드 → 릴레이소설 신규 기능 → 아이폰 알림 미수신 근본 수정 순으로 진행했다. 커밋 18개, 34개 파일, +2,946 / −109. 사이드카 v0.2.0 → v0.3.2.

## 완료된 작업

**1. 채팅 첨부 캡션 (v0.7.0)**
- 첨부 확인 시트에 선택 입력 캡션란. 여러 파일은 파일마다 개별 입력
- `sendFile(file, caption)` → `sendImage`로 전달, `text` 필드에 저장
- `onNewMessage` 푸시 본문도 캡션 반영 (`📸 캡션` / `📎 캡션`)

**2. iOS 채팅 입력 — 3회 시도 끝에 해결 (v0.7.0 → v0.11.0)**
- v0.7.0: 전송 버튼이 전송 직후 `disabled`가 되며 iOS가 포커스 해제 → `aria-disabled` + `data-inactive`로 대체
- v0.7.1: `window.scrollTo(0,0)`로 iOS 스크롤을 되돌리며 진동 → 제거
- v0.7.2: iOS 두 동작 모드(PWA=레이아웃 뷰포트 축소 / 사파리=유지) 중 하나만 처리 → `--vv-height` 추가
- **v0.11.0 (최종)**: 인셋 계산을 완전히 제거. 채팅 화면을 `position: fixed` + `top: var(--vv-top)` + `height: var(--vv-height)`로 보이는 영역에 직접 고정하고, 입력 바를 `chat-screen` 안의 일반 흐름 요소(`position: relative`)로 전환
- 신규 파일: `src/hooks/useKeyboardInset.ts`

**3. 사이드카 전역 단축키 (사이드카 v0.3.0 → v0.3.2)**
- `Win+Alt+Q`로 어디서든 채팅 열기. 네이티브 모듈 없이 `sidecar/hotkey.ps1`(Win32 `RegisterHotKey`) + `sidecar/focus-window.ps1`
- `config.json`의 `hotkey`로 변경 가능(기본 `Win+Alt+Q`, `false`면 비활성화)
- **단일 인스턴스 판정을 PID 파일 → 포트 바인딩(EADDRINUSE)으로 교체.** 옛 v0.2.0이 살아 있어 새 버전이 계속 종료되던 문제가 있었다
- PIN 우회: 30초 만료·1회용 토큰을 `127.0.0.1:48620/unlock`에서 검증. 이미 열린 창은 `/unlock-pending` 폴링으로 처리

**4. 다크모드 (v0.9.0)**
- 세 번째 테마 `dark` 추가 (기존 고대비는 저시력용으로 유지)
- 대비 실측: 본문 15.6:1, 보조 9.2:1, 강조 8.5:1, 말풍선 7.5~12.5:1 — 전 항목 WCAG AA 통과
- **`[data-theme="dark"]`는 `:root`와 특이도가 같아 일부 요소에 밝은 값이 남는다. `html[data-theme="dark"]`로 선언해야 한다** (실제로 겪음)
- 설정 테마 선택을 3카드 + 텍스트 라벨로 개편

**5. PIN 생략 (v0.10.0)**
- `isPinFreeEmail`(= 기존 `ADMIN_EMAIL` 재사용)로 지정 계정은 PIN 잠금 생략. 효과와 렌더 양쪽에서 건너뛴다(렌더까지 막지 않으면 잠금화면이 한 프레임 스친다)

**6. 릴레이소설 신규 (v0.12.0 → v0.13.3)**
- 명령: `시작` `쓰기` `끝` `완결` `도움` `제목` `배경` `초기화` / 축약 `/릴소`
- **슬래시 명령만 처리.** 초기 구현은 세션 진행 중 일반 대화를 턴으로 기록하는 문제가 있었다(소장님 스크린샷으로 확인) → 턴은 `/릴소 쓰기 내용`으로 명시
- 한 턴씩 교대(`nextTurnUid`), 상단 띠에 차례 표시. `끝`·`도움`은 차례인 사람만
- 제목·배경은 차례와 무관하게 둘 다 언제든 추가·삭제. 배경은 이어쓰기 도움에 함께 전달
- `초기화`는 양측 동의(`resetVotes`) 필요하며 세션을 `discarded`로 닫는다 — 비우기만 하면 빈 세션이 남아 `시작`이 막힌다
- 홈에 서재 메뉴 신설, 완결본 열람·`.md` 저장
- 신규: `src/lib/relayNovel.ts`, `src/hooks/useRelayNovel.ts`, `src/screens/RelayNovelScreen.tsx`, `src/components/RelayNovelBanner.tsx`, `RelayNovelInfoSheet.tsx`
- Firestore: `couples/{id}/relayNovels` 규칙 + `status`/`completedAt` 복합 인덱스 배포

**7. DeepSeek 이어쓰기 (Cloud Function `relayNovelAssist`)**
- API 키를 번들에 노출하지 않기 위해 Function 경유. 키는 `functions/.env`(gitignore)
- 호출자가 해당 커플 구성원인지 서버에서 검증, 최근 20턴·각 1000자 제한, 25초 타임아웃
- **`deepseek-v4-flash`는 추론형 모델이라 `max_tokens`가 추론에 먼저 소진된다.** 300이면 본문이 빈 채 돌아온다(`finish_reason: length`, `reasoning_tokens: 300`, `content` 길이 0) → **1500으로 설정**

**8. 알림 미수신 근본 수정 (v0.14.0 → v0.14.1) — 세 겹으로 막혀 있었음**
- (a) 두 사용자 모두 `notificationSettings.message = false` → 값 복구
- (b) 알림 설정이 localStorage에만 있어, 오래된 로컬값을 가진 기기에서 **알림음만 바꿔도 전체 설정이 서버에 덮어써짐** → `syncSettingsFromServer` 추가, 서버를 원본으로 전환
- (c) 배포된 `firebase-messaging-sw.js`에 `__VITE_FIREBASE_*__` 플레이스홀더가 그대로 남아 SW의 FCM 초기화 실패 → 치환을 빌드 마지막 단계 `scripts/inject-sw-env.mjs`로 분리, 누락 시 **빌드 실패**
- (d) notification 페이로드가 있으면 `showNotification`을 호출하지 않고 조기 반환 → iOS PWA는 자동 표시가 없어 앱이 닫히면 무표시 → 항상 SW가 표시하도록 통합
- 유선님 아이폰 수신 **확인 완료**
- 죽은 토큰 1개(`registration-token-not-registered`) 정리

**9. 문서/기록**
- 완료보고서: `docs/claude-code-2026-08-02-relay-novel-dark-theme-ios-chat-notification.md` (커밋 `40a1494`)
- Vault 복사: `G:\내 드라이브\SVIL Vault\03_PRJ\Tether\Tether_완료보고서_20260802_...md`
- Outline `Tether 개발진행 히스토리`(`f608cb50-…`)에 v0.7.0~v0.14.1 섹션 추가
- Outline `Tether 프로젝트 위키`(`ba69cbcc-…`) 갱신 — 버전 v0.5.10 → v0.14.1, 운영 메모에 알림·테마·뷰포트 규칙 추가

## 진행 중 / 미완료 작업
- **아이폰 채팅 입력(v0.11.0) 실기기 미확인** — 전송 후 입력창이 키보드 위에 유지되는지. 레이아웃은 브라우저에서 5개 시나리오 좌표로 검증했으나 실기기는 못 봄
- **릴레이소설 화면 조작 미확인** — 데이터 흐름은 실제 Firestore로 26개 검증했으나 UI 조작(`/릴소 시작` → `쓰기` → `도움` → `완결` → 서재)은 미실행
- **소장님 기기 알림 수신 미확인** (당시 기기 없음). 토큰 2개 모두 유효, 테스트 발송 성공은 확인됨
- `package.json` 버전(0.5.12)과 `APP_VERSION`(0.14.1) 불일치 — 정리 필요
- 로그인 필요한 화면의 UI E2E 자동화 불가 — Firebase CLI 로그인 토큰으로는 custom token 발급이 IAM(`iam.serviceAccounts.signBlob`)에 막힌다. **서비스 계정 키가 있으면 가능** (`FIREBASE_SERVICE_ACCOUNT_PATH`)

## 주요 결정사항 / 규칙
- **알림 설정의 원본은 서버다.** localStorage는 캐시. 알림 문제 재발 시 값부터 되돌리지 말고 **어느 기기가 언제 덮어썼는지**를 먼저 본다. (a) 원인은 2026-07-21 세션에서 이미 나왔던 것인데 그때 값만 되돌려 재발했다
- **iOS에서 알림을 표시하는 주체는 서비스워커다.** notification 페이로드가 있어도 SW가 반드시 `showNotification`을 호출해야 한다
- **채팅 화면은 visualViewport에 직접 고정한다.** 키보드 높이를 계산해 요소를 띄우는 방식으로 되돌리지 말 것 — iOS에서 진동·오정렬이 세 번 반복됐다
- **릴레이소설은 슬래시 명령만 처리한다.** 일반 대화를 턴으로 잡지 않는다
- 테마 변수는 `html[data-theme="..."]` 특이도로 선언한다
- 배포 전 번들에 Firebase 설정 주입 여부를 검사하고, 배포 후 실제 URL을 열어 확인한다

## 참고 정보
- 저장소: `C:\Projects\tether` (브랜치 `main`, https://github.com/kuroicode-beep/tether)
- 운영 URL: https://tether-d1dab.web.app / Firebase 프로젝트 `tether-d1dab`
- 최종 커밋: `40a1494` (코드 최종 `7a9724d`)
- 리뷰용 PR: https://github.com/kuroicode-beep/tether/pull/1 — base `review-base/session-2026-08-02`, **머지 금지**(이미 main 반영됨)
- 검증 스크립트: `scripts/test-relay-command.ts`(35), `scripts/test-relay-turns.ts`(32), `scripts/test-relay-firestore.mjs`(26, 실제 DB에 쓰고 자동 삭제)
- 사이드카: `C:\Projects\tether\sidecar\` v0.3.2 상주 중. ping `127.0.0.1:48620/ping`
- Outline: 프로젝트 위키 `ba69cbcc-1869-4f0c-9cde-577f352c209d` / 히스토리 `f608cb50-c425-4d3f-b7e3-e1ce4c5b4d93`
- **주의**: `functions/.env`(DeepSeek 키)는 gitignore라 저장소에 없다. 다른 환경에서 Functions 배포 시 별도 설정 필요
- **주의**: 워크트리(`.claude\worktrees\nice-perlman-101d1d`)에는 `.env`가 없다. 여기서 빌드·배포하면 Firebase 설정이 빈 번들이 나간다 — 이번 세션에서 실제로 사고가 났다. 배포는 메인 repo에서 하거나 `.env`를 복사할 것

## 다음 세션 시작 시 할 일
1. 소장님께 **아이폰 채팅 입력(v0.11.0)** 과 **릴레이소설 UI 흐름** 실기기 결과 확인. 문제 있으면 그 지점부터
2. 소장님 기기 알림 수신 확인 (유선님 기기는 확인 완료)
3. `package.json` 버전을 `APP_VERSION`과 맞출지 결정 (현재 0.5.12 vs 0.14.1)
4. 서비스 계정 키를 받을 수 있으면 로그인 E2E 자동화 구축 — 이번 세션의 버그 상당수가 실제 실행으로만 잡혔다
5. 릴레이소설 사용 후 피드백 반영 (턴 쓰기에 매번 `/릴소 쓰기`를 붙이는 게 번거로울 수 있음 — 내 차례일 때만 일반 입력을 턴으로 받는 절충안 제안 가능)
