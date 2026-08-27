# 핸드오프 — Tether 채팅 기록 전체 삭제 + 서비스 점검 모드 (v0.26.0)

## 대상

- 프로젝트: Tether (커플 2인 전용 PWA, React + Vite + TS + Firebase)
- 작업 폴더: `C:\Projects\tether` (세션은 워크트리 `chat-data-deletion-102253`에서 진행 → main 병합 후 워크트리·브랜치 삭제 완료)
- 세션 시각: 2026-08-27 23:50 (KST)
- 배포: `https://tether-d1dab.web.app` — **현재 점검 모드 ON**

## 세션 요약

"채팅 데이터 삭제" 지시로 시작해, 데이터를 지우는 수단과 지우는 동안 외부 접속을 막는 수단을 함께 만들었다. v0.25.1 → v0.26.0. **실제 데이터 삭제는 아직 실행되지 않았다.**

## 🔴 지금 상태 — 이어받는 사람이 먼저 알아야 할 것

1. **서비스가 점검 중이다.** 누가 접속하든 점검 화면만 보인다. 관리자 우회는 `https://tether-d1dab.web.app/?bypass=<BYPASS_VALUE>` — **실제 값은 `src/lib/maintenanceFlag.ts`의 `BYPASS_VALUE`에 있다**(문서에 평문으로 적지 않는다). localStorage에 기억되고, 해제는 `?bypass=off`.
2. **채팅 데이터는 아직 그대로다.** 삭제는 앱에서 사람이 눌러야 한다 — 설정 → 맨 아래 "채팅 기록 전체 삭제".
3. **삭제가 끝나면 점검을 풀어야 한다.** `src/lib/maintenanceFlag.ts:5`의 `MAINTENANCE_MODE`와 `public/landing/index.html`의 `MAINTENANCE_NOTICE`를 **둘 다** `false`로 바꾸고 재배포.

## 완료한 작업

### 채팅 기록 전체 삭제 기능

채팅은 세 군데에 흩어져 있다. 하나라도 남기면 다른 경로로 계속 보인다.

| 대상 | 경로 | 빠뜨렸을 때 |
|---|---|---|
| 메시지 | Firestore `couples/{id}/messages` | — |
| 첨부 인덱스 | Firestore `couples/{id}/files` | 라이브러리 화면에 파일 목록이 남는다 |
| 첨부 실물 | Storage `couples/{id}/images/**`, `couples/{id}/files/**` | URL을 아는 사람이 계속 연다 |

- `src/hooks/useChatWipe.ts` — 배치(400건) 삭제 + Storage 재귀 삭제, 진행률 실시간 표시
- `src/screens/SettingsScreen.tsx` — Misc 섹션에 항목 + 확인 다이얼로그, 완료 후 "앱 새로고침"
- `src/lib/firebase.ts` — `purgeFirestoreCacheNow()` 추가(삭제 직후 이 기기 IndexedDB 정리), `CACHE_PURGE_KEY`를 `2026-08-27`로 갱신(상대 기기는 다음 접속 시 1회 퍼지)

### 🔴 보안 규칙 완화 (기억해 둘 것)

기존 규칙은 `resource.data.senderUid == request.auth.uid`라 **자기가 보낸 것만** 지워졌다. 2인 전용 공간에서 대화 초기화는 양쪽을 다 지워야 의미가 있어 `isCoupleMember()`로 완화했다. Storage의 채팅 경로도 구성원이면 delete 허용.

부수 효과: 상대방 메시지를 개별 삭제하는 것도 이제 가능하다.

### 서비스 점검 모드

- `src/lib/maintenanceFlag.ts` — 빌드 상수 스위치 + 우회 로직
- `src/screens/MaintenanceScreen.tsx` — 공지 화면 (Context 비의존)
- `src/App.tsx` — Provider **위**에서 게이트. 인증·세션을 읽기 전에 막는다
- `src/hooks/useMaintenanceMode.ts` + `AdminScreen` — Firestore `adminConfig/maintenance` 기반 관리자 토글 (1차 구현물, 그대로 유지)

**설계가 한 번 바뀐 이유**: 처음엔 Firestore 플래그만으로 만들었는데, 그 값은 인증 후에만 읽혀서 **로그아웃 상태나 커플 연결이 끊긴 접속은 점검 화면을 못 보고 온보딩으로 갔다.** 사용자 지적으로 발견해 빌드 상수 게이트를 최상위에 추가했다.

**한계**: 앱 화면 레벨 차단이라 브라우저 콘솔에서 SDK를 직접 호출하면 데이터에 닿는다. 규칙 레벨 차단은 요청당 `get()` 증가와 관리자까지 잠길 위험 때문에 보류했다. 우회 값도 클라이언트 번들에 노출된다.

### 미사용 산출물

`scripts/chat-wipe.ts` — Admin SDK 기반 backup/wipe/verify 도구. 서비스 계정 키가 없어 실행하지 못했고, 앱 내 기능으로 방향을 틀면서 미사용으로 남겼다. 키가 생기면 `FIREBASE_SERVICE_ACCOUNT_PATH` 지정 후 `npm run chat:backup` / `chat:wipe` / `chat:verify`로 쓸 수 있다. 이 도구만 백업 기능을 가진다.

## 검증한 것

| 대상 | 결과 |
|---|---|
| 빌드·타입체크 | 통과 |
| lint (변경 파일) | 에러 0 |
| 점검 화면 렌더 | dev·라이브 모두 확인 |
| 로그아웃 상태 차단 | 확인 |
| `?bypass=<BYPASS_VALUE>` | 앱 진입 확인 (라이브) |
| 우회 기억 / `?bypass=off` | 확인 |
| 점검 문서 읽기 실패 시 fail-open | `permission-denied` 상황에서 정상 사용자가 잠기지 않음 확인 |
| 삭제 스크립트 안전장치 3종 | 백업 누락·없는 경로·`--yes` 누락 모두 서버 접근 전 차단 |

**검증하지 못한 것**: 실제 삭제 동작. 되돌릴 수 없어 실행하지 않았다.

## 남은 작업

- [ ] 앱에서 채팅 기록 전체 삭제 실행 (담당: 소장님)
- [ ] `MAINTENANCE_MODE = false` + 재배포 (담당: 다음 세션, 삭제 확인 후)
- [x] 랜딩 페이지 점검 안내 — `/landing/`은 게이트에 안 걸려 계속 열리므로 상단 배너를 추가했다(5개 언어). 🔴 **점검 스위치가 둘이다**: `src/lib/maintenanceFlag.ts`의 `MAINTENANCE_MODE`와 `public/landing/index.html`의 `MAINTENANCE_NOTICE`. 끌 때 둘 다 끈다
- [ ] (선택) 규칙 레벨 접속 차단 — 삭제 작업이 끝난 뒤에 올릴 것(배치 쓰기마다 `get()`이 늘어난다)

## 주의사항

- **백업이 없다.** 앱 내 삭제는 백업을 뜨지 않는다. `C:\Users\kuroi\Documents\tether_chat_backup_20260807.json` 이후의 대화는 지우면 복구 불가
- **다음에 또 대량 삭제하면** `src/lib/firebase.ts`의 `CACHE_PURGE_KEY` 날짜를 그날짜로 바꿔야 모든 기기에서 재퍼지된다. 안 바꾸면 상대 기기에 지워진 대화가 계속 보인다
- 재사용 절차는 개인 스킬 `tether-chat-wipe`에 정리해 두었다
- 이 세션에서 **작업 날짜를 2026-08-20으로 잘못 기록**했다가 마무리 단계에서 2026-08-27로 정정했다. 커밋 `1f28991`. 옛 날짜 표기가 보이면 오기다

## Git

- 커밋: `5241c45` → `f867800` → `2341eb0` → `21395b0` → `1f28991` (main)
- 배포: hosting + firestore.rules + storage.rules 완료
- 워크트리·작업 브랜치: 삭제 완료
- 상세 보고서: `docs/report_20260827_채팅삭제_점검모드_v0.26.0_ClaudeCode.md`
