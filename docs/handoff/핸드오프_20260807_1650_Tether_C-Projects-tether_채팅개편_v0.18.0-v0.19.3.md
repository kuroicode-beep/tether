## 대상

- 프로젝트: Tether (커플 전용 PWA)
- 작업 폴더: `C:\Projects\tether` (세션은 워크트리 `nice-perlman-101d1d`에서 진행 → PR #2 병합 후 워크트리 제거 완료)
- 세션 시각: 2026-08-07 16:50 (KST)

## 세션 요약

소장님 지시로 채팅 데이터 전체 초기화 후, 순서 꼬임·속도 저하·입력 편의 문제를 연쇄 해결했다. v0.17.0 → **v0.19.3** (7개 릴리즈, 전부 라이브 배포). 사이드카 v0.3.2 → **v0.4.0**.

## 완료된 작업

1. **채팅 전체 초기화 (비가역)** — Admin SDK로 메시지 12,141건·파일 인덱스 16건·Storage 이미지 39/파일 21 삭제. **백업 유일본**: `C:\Users\kuroi\Documents\tether_chat_backup_20260807.json`. 릴레이소설 서재(`relayNovels`)는 보존.
2. **v0.18.0** (1c42a38) — 메시지 `createdAt`을 `serverTimestamp()`로 통일(기기 시계 어긋남 → 순서 꼬임 해결, 표시엔 `serverTimestamps:'estimate'`). 채팅 진입 시 오늘 대화만 구독, "이전 내용 보기" 버튼으로 30건씩 페이지네이션(경계 기반 `createdAt <`).
3. **v0.18.1** (f106792) — 대량 삭제 후 각 기기 IndexedDB에 유령 문서가 남아 채팅창 저하 → 부팅 시 1회성 캐시 퍼지(`terminate`+`clearIndexedDbPersistence`+reload, localStorage 플래그 `tether:fscache-purged:2026-08-07`). 렌더 O(n²) `findIndex` 제거, `MessageBubble` 내용 비교 메모이즈.
4. **v0.19.0** (45e532b) — 상대방 "입력 중" 표시. `couples/{id}/typing/{uid}` 하트비트(serverTimestamp, 2.5초 스로틀, TTL 6초, 전송/비움/이탈 시 삭제). firestore.rules에 typing 규칙(본인 문서만 쓰기) 추가 **배포 완료**.
5. **v0.19.1** (f0eddc6) — **앱 전역 저하의 근원 해결**: 미읽음 배지 리스너가 messages/diary/contents 컬렉션 전체를 무제한 구독하고 있었음 → 채팅 최근 100·일기 50·콘텐츠 lastRead 이후 50으로 한도. 화면 14개 React.lazy 분할(초기 JS 1,152KB → 앱 178KB + vendor react 142KB/firebase 653KB). vite manualChunks 분리.
6. **v0.19.2** (0bceea9) — 채팅 입력창 포커스 시 한글 IME 자동 전환. 웹은 OS IME 제어 불가 → 사이드카 v0.4.0에 `GET /ime/hangul` 신설(`ime-hangul.ps1`: 전경 창이 Tether일 때만 `WM_IME_CONTROL`로 IMC_SETOPENSTATUS+IMC_SETCONVERSIONMODE=한글). 실행 중 사이드카 재시작 후 실제 전환 검증(`OK:1`). 입력창 `lang="ko"` 힌트(v0.18.2, 48ab9ee)는 보조.
7. **v0.19.3** (38f3791) — 채팅 화면 보는 중엔 메시지 알림(토스트·소리) 끔. FCM 포그라운드·SW 사운드 릴레이 양 경로 모두. 상태·일기 알림과 백그라운드 동작은 유지.
8. **병합·정리** — PR https://github.com/kuroicode-beep/tether/pull/2 **병합 완료**(2026-08-07 16:49 UTC+9), main pull 완료(432bb26). 작업 브랜치 로컬·원격 삭제, 워크트리 git 등록 해제.
9. **기록** — 완료보고서 `docs/reports/report_20260807_채팅개편_v0.18.0-v0.19.3_ClaudeCode.md`(커밋 8e1b8cf). Outline `Tether 프로젝트 위키`(ba69cbcc-…)에 갱신 섹션 append. 프로젝트 메모리 `chat-reset-20260807.md` 추가.

## 진행 중 / 미완료 작업

- **실기기 확인 대기**: ① 두 기기 순서 정렬·속도 체감 ② "입력 중" 표시 ③ 한글 자동 전환(이 PC) ④ 채팅 중 알림 무음. 문제 발견 시 해당 버전 커밋부터 추적.
- 새 MS IME가 WM_IME_CONTROL을 무시하는 기기가 나오면: 이전 버전 Microsoft IME 호환성 옵션 안내 필요.
- 워크트리 폴더 `.claude/worktrees/nice-perlman-101d1d`가 디스크에 잔존(이 세션이 그 안에서 실행 중이라 잠김). git 추적은 이미 해제됨 — 세션 종료 후 폴더 삭제하면 끝. `.git/worktrees/*` 메타 잔존도 동일.
- 오래된 로컬 브랜치 `claude/chat-caption-ios-kb` 잔존(이번 세션과 무관) — 정리 여부 소장님 판단.
- 메인 저장소의 무관한 미커밋 변경(`src/screens/DiaryScreen.tsx`, `.cursor/rules/*`, 루트 untracked 다수)은 이번에도 건드리지 않음.

## 주요 결정사항 / 규칙

- **메시지 시각은 serverTimestamp가 기준.** 클라이언트 시계(`Timestamp.now()`)로 되돌리지 말 것 — 두 기기 시계가 어긋나면 순서가 꼬인다.
- **컬렉션 무제한 onSnapshot 금지.** 배지·피드류 상시 리스너는 반드시 limit/기간 경계를 건다. 무제한 구독이 로컬 캐시를 무한히 키워 앱 전역을 느리게 만든 실사례.
- **대량 삭제 후에는 클라이언트 캐시 퍼지 필요.** 서버 삭제는 클라이언트 IndexedDB에 전파되지 않는다. 재발 시 `firebase.ts`의 퍼지 플래그 키를 새 날짜로 갱신.
- **사이드카 코드 수정 시**: 메인 저장소 `sidecar/`에 반영 + 재시작(포트 48620)해야 실동작. 워크트리에서 수정만 하면 반영 안 됨.
- 채팅 진입 기본 뷰는 "오늘 대화"다. 과거는 버튼으로만 로드한다.

## 참고 정보

- 운영: https://tether-d1dab.web.app / Firebase `tether-d1dab` / 커플 ID `23uQLvKxuVe1mmtwxwTzSDfXEDI2_6xcREXYFS2WqP1pavVEaYxEm7bi1`
- 커밋: 1c42a38 → 38f3791(코드 7개) + 8e1b8cf(보고서), 병합 후 main `432bb26`
- Outline: 프로젝트 위키 `ba69cbcc-1869-4f0c-9cde-577f352c209d`(2026-08-07 섹션 추가됨, §02 버전 표기는 낡음)
- 사이드카: `C:\Projects\tether\sidecar\` v0.4.0 상주 중, ping `127.0.0.1:48620/ping`
- 채팅 백업: `C:\Users\kuroi\Documents\tether_chat_backup_20260807.json` (12,141건, 유일본 — 지우지 말 것)
- 주의(기존): 워크트리에는 `.env`가 없다. 배포 빌드는 메인 repo에서 하거나 `.env` 복사 필요 — 이번 세션 워크트리에는 `.env`가 있었음(빌드·배포 정상).

## 다음 세션 시작 시 할 일

1. 소장님·유선님 실기기 체감 확인(속도·순서·입력 중 표시·한글 전환·알림 무음) — 문제 있으면 그 지점부터.
2. 채팅이 다시 쌓인 뒤(수백 건) "이전 내용 보기" 페이지네이션 동작 확인.
3. 필요 시 세션 종료 후 잔존 워크트리 폴더 삭제(`.claude/worktrees/nice-perlman-101d1d`).
