# ✅ 완료 보고서 — 푸시 알림 근본 안정화 · Windows 사이드카 · PIN 키보드 입력 (Claude Code, 2026.07.21)

원본 작업지시문: 소장님 직접 요청 — "알림이 정말 안정이 끝까지 안돼. 왔다가 안왔다가. 윈도우 알림도 됐다가 안됐다가 그러는데 이거 본질적으로 고쳐줘"
기준 커밋: `6cb7a0c`
작업 브랜치: `main`

---

## 01. 작업 요약

- 목표: 푸시 알림 불안정("왔다갔다") 근본 해결 + 파생 요청(사이드카, 포커스 기준 알림, PIN 키보드 입력)
- 결과: **완료** — 양방향 FCM 전달 E2E 검증, 사이드카 상주 중, 전 항목 배포 완료
- 앱 버전: v0.5.12 → **v0.6.1**

---

## 02. 근본 원인 분석

배포 성공만으로 끝내지 않고 Functions 로그 + Firestore를 직접 조회해 원인을 특정했다.

| 관측 | 해석 |
|---|---|
| B→A: `successCount: 2` | 정상 전달 |
| A→B: `partner tokens resolved` 후 `multicast result` 없음 | `isNotificationEnabled`에서 조기 종료 |
| Firestore 조회: userB `notificationSettings.message = false` | **진짜 원인 — 코드가 아닌 데이터 문제** |
| `couples/{id}.isDisconnected` | 이미 해소 상태(과거 차단 원인), self-healing으로 재발 방지 |

즉 "왔다갔다"의 실체는 **방향에 따라 알림이 막히는 비대칭 상태**였다.

---

## 03. 변경된 파일

| 파일 경로 | 변경 내용 | 커밋 |
|---|---|---|
| `functions/src/index.ts` | `getPartnerToken` stale `isDisconnected` self-healing (양 멤버 coupleId 일치 시 플래그 자동 삭제 후 진행) | `5d723db` |
| `src/lib/pushTokenSync.ts` | FCM 토큰 7일 TTL 강제 갱신(`deleteToken`→`getToken`), 사이드카 감지 시 토큰 해제/복구 | `5d723db`, `5d808f4` |
| `sidecar/index.js` 외 6개 | Windows 알림 사이드카 신규 (Firestore 직접 수신) | `6e6c883`, `5d808f4` |
| `public/firebase-messaging-sw.js` | 알림 억제 기준 `visible` → `focused` | `34d9243` |
| `src/App.tsx` | 포커스 시 무음 토스트, 비포커스 시 소리 재생 | `34d9243` |
| `src/screens/LockScreen.tsx` | 물리 키보드/넘패드 PIN 입력 (0-9, Backspace/Delete) | `13794b5` |
| `src/lib/appVersion.ts`, `src/screens/ReleaseLogScreen.tsx` | v0.6.0 / v0.6.1 버전·릴리스 로그 | `5d808f4`, `34d9243` |

**Firestore 데이터 정정 (코드 외)**
- `users/6xcREX…`: `notificationSettings.message` `false` → `true`
- `couples/…/status/6xcREX…`: mood 배열에서 "공부중" 제거

---

## 04. 구현 결과

✅ **완료 항목**

1. **Functions self-healing** — `isDisconnected: true`여도 양 멤버의 `users/{uid}.coupleId`가 해당 커플을 가리키면 플래그를 자동 삭제하고 알림 진행. 다른 커플의 동일 잠재 이슈까지 예방.
2. **FCM 토큰 7일 강제 갱신** — `tether_fcm_sync_ts`로 마지막 동기화 추적, 만료 전 선제 재발급.
3. **Windows 사이드카 v0.2.0** (`sidecar/`)
   - Firestore `onSnapshot` 직접 수신 → 크롬/FCM 5단계 고리를 1단계로 축소, 크롬이 꺼져도 알림 수신
   - 커스텀 알림음(gentleKnock 등) PowerShell `SoundPlayer`로 직접 재생 — 웹푸시의 OS 기본음 한계 우회
   - 로컬 ping 서버(`127.0.0.1:48620`, CORS + PNA preflight) → 웹앱이 감지 시 자기 FCM 토큰 해제 → **크롬 중복 알림 차단**, 사이드카 종료 시 자동 복구
   - `GetForegroundWindow`로 Tether 창 포커스 시 토스트·소리 억제
   - 단일 인스턴스 lock, 무변경 write 스킵, firebase CLI 로그인 재사용(신규 시크릿 저장 없음), 로그에 본문 미기록
   - 시작프로그램 자동 등록 완료(`shell:startup`), 현재 상주 중
4. **포커스 기준 알림 (전 플랫폼)** — `WindowClient.focused` / `document.hasFocus()` 표준 API 사용. 사이드카 없는 macOS 등에서도 "앱 포커스 시 무음, 꺼짐·타 창 포커스 시 알림" 동작.
5. **PIN 물리 키보드 입력** — 상단 숫자열·넘패드 모두 지원, Backspace/Delete 삭제, 4자리 시 기존 자동 로그인 로직 그대로 발동. 수정자 조합 무시, 잠금 상태 가드 유지.

⚠️ **미완료 / 보류**

- **안드로이드 커스텀 알림음** — 사이드카 방식은 Android Doze로 부적합. TWA(기존 PWA 래핑)가 정답으로 결론, 소장님 판단으로 **보류**.
- macOS 사이드카 — 크로스 플랫폼 버전 제작 가능하나 **보류**(v0.6.1 포커스 알림으로 기본 커버됨).

---

## 05. 검증

| 항목 | 결과 |
|---|---|
| Functions / 클라이언트 TypeScript 빌드 | ✅ 통과 |
| A→B 푸시 E2E (`onStatusUpdate` 트리거) | ✅ `successCount: 2, failureCount: 0` |
| B→A 푸시 | ✅ `successCount: 2, failureCount: 0` |
| 사이드카 ping / PNA preflight | ✅ `{"ok":true,...,"version":"0.2.0"}`, 204 + `Allow-Private-Network` |
| 사이드카 토스트·사운드 | ✅ 실제 데스크톱 토스트 2회 수신(gentleKnock) |
| 사이드카 단일 인스턴스 / 무변경 스킵 | ✅ 2번째 실행 거부, touch만 한 write는 알림 없음 |
| PIN 키보드 입력 | ✅ 실제 컴포넌트 격리 마운트로 키 이벤트 → dot 채움·Backspace 삭제 확인 |

---

## 06. 특이점 / 결정사항

- **"배포됨 = 해결됨"으로 끝내지 않았다.** 1차 코드 수정 배포 후에도 증상이 남아, Functions 로그와 Firestore를 직접 열어 데이터 원인(`message: false`)을 찾아냈다. 이번 건의 핵심 교훈.
- 사이드카는 **윈도우에 한해** FCM을 대체한다. 안드로이드 FCM은 Google Play Services가 상시 전달해 이미 안정적이므로 사이드카가 불필요하다.
- PIN 검증 중 브라우저 프리뷰에서 키보드가 동작하지 않아 한참 헤맸는데, 원인은 **편집은 메인 repo·dev 서버는 worktree 서빙**이라 프리뷰에 코드가 없던 것이었다. 코드 문제 아님을 확인 후 worktree 동기화로 실증.

---

## 07. 남은 작업

- [ ] 안드로이드 TWA 제작 (커스텀 알림음 필요 시) — 담당: Claude Code, 소장님 요청 시
- [ ] macOS 크로스 플랫폼 사이드카 — 담당: Claude Code, 필요 시
- [ ] 실기기 장기 관찰(며칠간 알림 누락 재발 여부) — 담당: 소장님

---

## 08. Git 커밋

| 커밋 | 내용 |
|---|---|
| `5d723db` | 푸시 알림 self-healing + 토큰 7일 강제 갱신 |
| `6e6c883` | Windows 사이드카 v0.1.0 신규 |
| `5d808f4` | 사이드카 v0.2.0 (포커스 억제, 크롬 중복 차단, 자동시작) |
| `34d9243` | 포커스 기준 알림 전 플랫폼 적용 (v0.6.1) |
| `13794b5` | PIN 물리 키보드 입력 |

배포: Firebase Hosting + Functions(`onNewMessage`, `onStatusUpdate`, `onNewDiary`) 배포 완료 — https://tether-d1dab.web.app

---

*SVIL — Tether 푸시 안정화 & 사이드카 | Claude Code | 2026.07.21*
