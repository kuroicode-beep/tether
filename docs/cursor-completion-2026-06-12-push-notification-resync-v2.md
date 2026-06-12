# ✅ 완료 보고서 — 알림 미수신 재발 원인 분석 및 핫픽스 (Cursor, 2026.06.12)

원본 작업지시문: 사용자 요청 — 알림 미수신 재발, 원인 분석·수정·테스트·보고서  
기준 커밋: `dcccdfe` (v0.2.0)  
작업 브랜치: `main`

---

## 01. 작업 요약

- **증상:** 재연결/배포 이후 모바일·PC에서 푸시 알림이 다시 오지 않음
- **결과:** 클라이언트 토큰 재동기화 + Functions 진단/검증 보강 완료, `npm run build` 및 Functions 빌드 통과
- **실기기 QA:** 미실행 (소장님 확인 필요)

---

## 02. 원인 분석 (Root Cause)

### 🔴 Primary — FCM 토큰 재등록 타이밍 부족

| 구간 | 문제 |
|---|---|
| **PWA SW autoUpdate** | Workbox SW 교체 후 FCM 구독 토큰이 무효화될 수 있으나, `controllerchange` 시 재발급 없음 |
| **탭 복귀** | `visibilitychange`만으로는 SW 갱신 직후 타이밍 miss 가능 |
| **Session `restoring`** | 탭 복귀마다 `refreshSession` → `restoring` → auto-sync skip 구간 반복 |
| **localStorage `tether_fcm_granted`** | 브라우저 permission과 불일치 시 “등록됨”으로 보이지만 sync skip |

**결과:** Firestore `users/{uid}.fcmTokens`가 **만료/빈 토큰** 상태 → Functions `[Push] no partner tokens` 또는 multicast `failureCount > 0`

### 🟠 Secondary — 서버/재연결 경계

| 구간 | 문제 |
|---|---|
| **`claimInvite` 재연결** | 기존 couple doc의 `isDisconnected: true`가 남을 수 있음 (발송 skip 조건 추가) |
| **`getPartnerToken`** | partner `coupleId` mismatch 미검증 → 재연결 직후 stale partner doc 가능 |
| **invalid token cleanup** | 실패 토큰 삭제 후 **앱 재오픈 전**까지 partner 알림 불가 (의도된 동작이나 UX상 “또 안 옴”) |

### 🟡 Non-issue (이번 증상과 무관 또는 정상)

- iOS Safari **탭**에서는 push 자체 불가 → standalone PWA 필요 (기존 정책)
- Foreground dedup / sound — “안 옴”과 별개
- Firestore rules — `fcmTokens` self-update 허용 정상

---

## 03. 수정 내용

### Client

| 파일 | 변경 |
|---|---|
| `src/lib/pushTokenSync.ts` | **신규** — retry(3), SW `controllerchange`, focus/visibility auto-sync, permission reconcile |
| `src/hooks/usePushNotification.ts` | stable `useCallback`/`useMemo`, core sync 위임 |
| `src/App.tsx` | `installPushTokenAutoSync`, connected+unlock 시 추가 sync |
| `src/context/SessionContext.tsx` | connected 상태 탭 복귀 시 **lightweight refresh** (restoring 루프 제거) |
| `src/screens/SettingsScreen.tsx` | **알림 다시 등록** 버튼 + sync 결과 메시지 |

### Cloud Functions

| 파일 | 변경 |
|---|---|
| `functions/src/index.ts` | `claimInvite` 시 `isDisconnected` 플래그 제거 |
| | `getPartnerToken` — disconnected skip, partner `coupleId` 검증, tokenCount/fcmUpdatedAt 로그 |
| | `sendWebPush` — per-token failure warn 로그 |
| | `onStatusUpdate` — 초기 create/무변경 write skip |

### Log

- `ReleaseLogScreen` — `2026-06-12-hotfix-push-token-resync-v2` 항목 추가

---

## 04. 검증

| 항목 | 결과 |
|---|---|
| `npm run build` | 통과 |
| `functions` TypeScript build | 통과 (deploy 시) |
| 실기기 FCM E2E | 미실행 |

### 수동 QA 절차 (소장님)

1. **양쪽 기기** 설정 → 알림 **다시 등록** 탭
2. Firestore Console: `users/{uid}.fcmUpdatedAt` 최근 갱신 확인
3. A가 B에게 채팅 1건 → B 백그라운드 알림
4. Functions log: `[Push] partner tokens resolved` + `successCount >= 1`
5. 재연결 시나리오: disconnect → reconnect → **양쪽 앱 1회 열기** → 3번 반복

---

## 05. Claude Code 핸드오프 (미해결 시)

아래까지 적용 후에도 알림이 없으면 Claude Code에 넘길 것.

### 확인할 Firebase 로그 (우선순위)

```text
firebase functions:log --only onNewMessage,onStatusUpdate,onNewDiary
```

| 로그 | 의미 | 다음 액션 |
|---|---|---|
| `[Push] no partner tokens` | 수신자 Firestore에 토큰 없음 | 수신 기기에서 Settings → 다시 등록 |
| `[Push] partner coupleId mismatch` | 재연결 race / stale user doc | Session snapshot + claimInvite 트랜잭션 검토 |
| `[Push] couple disconnected — skip` | couple doc `isDisconnected` | claimInvite merge 확인 |
| `token send failed` + `invalid-registration-token` | 만료 토큰 | cleanup 정상, client resync 재확인 |
| (함수 invoke 없음) | Firestore trigger 미발화 | rules / coupleId / message write 경로 |

### Firestore 체크리스트

```text
users/{receiverUid}:
  coupleId: (sender와 동일)
  fcmTokens.web_*: (non-empty)
  fcmUpdatedAt: (최근 ISO)
  notificationSettings.message: != false
```

### Claude Code에 요청할 추가 작업 후보

1. **Callable `debugPushPing`** — Admin이 특정 uid에 test multicast (운영 진단용)
2. **Firestore trigger on `users.fcmUpdatedAt`** — 재연결 후 token 없으면 in-app banner
3. **iOS APNs web push** — data-only payload + `notification` block A/B 테스트
4. **`refreshSession` vs push sync** — E2E 자동화 (Playwright + emulator)

### 관련 파일

- `src/lib/pushTokenSync.ts`
- `functions/src/index.ts`
- `docs/cursor-completion-2026-06-12-push-notification-resync-v2.md` (본 문서)

---

## 06. Git / 배포

- 커밋 해시: `d74e92f`
- Functions 배포: 예 (`claimInvite`, `disconnectCouple`, `onNewMessage`, `onStatusUpdate`, `onNewDiary`)
- Hosting 배포: 예 — https://tether-d1dab.web.app

---

*SVIL — Tether Push Hotfix | Cursor | 2026.06.12*
