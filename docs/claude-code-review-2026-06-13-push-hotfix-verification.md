# ✅ 완료 보고서 — 푸시 알림 핫픽스(d74e92f) 검수 및 회귀 수정 (Claude Code, 2026.06.13)

원본 작업지시문: 소장님 직접 요청 — "검수하고 이상 있으면 수정하고 완료보고서 노션에 올려줘"
검수 대상: `cursor-completion-2026-06-12-push-notification-resync-v2.md` + 커밋 `d74e92f`
기준 커밋: `0a9462a`
작업 브랜치: `claude/nice-perlman-101d1d` (worktree)

---

## 01. 작업 요약

- 목표: Cursor 푸시 알림 핫픽스(d74e92f) 전체 검수, 이상 발견 시 수정
- 결과: **부분완료** — 검수 완료, 회귀 1건 수정, 빌드 통과 / **Functions 재배포는 미실행 (소장님 승인 필요)**
- 소요 시간: 약 30분

---

## 02. 검수 결과

### ✅ 정상 확인된 항목

| 영역 | 판정 | 근거 |
|---|---|---|
| `src/lib/pushTokenSync.ts` | 정상 | retry(3) 백오프, SW `controllerchange` 재동기화, permission reconcile 로직 모두 적절 |
| `src/hooks/usePushNotification.ts` | 정상 | `useCallback`/`useMemo` 안정화로 effect 재실행 루프 제거, core sync 위임 구조 적절 |
| `App.tsx` auto-sync 설치 | 정상 | `installPushTokenAutoSync` cleanup 반환, connected+unlock 추가 sync 동작 확인 |
| `SessionContext` lightweight refresh | 정상 | `restoreConnectionFromProfile` null 반환 시 stale connected 우려 있었으나, `users/{uid}` 문서 `onSnapshot` 리스너(289행~)가 coupleId 해제를 실시간 감지하므로 안전 |
| `claimInvite` 재연결 | 정상 | coupleId가 `uidA_uidB` 결정적 생성 → 동일 커플 재연결 시 같은 couple doc 재사용, `isDisconnected`/`disconnectedAt`/`disconnectedBy` merge-delete 적절 |
| `getPartnerToken` coupleId 검증 | 정상 | disconnect 시 양쪽 `coupleId: null` 처리와 일관, false-negative 경로 없음 확인 |
| `sendWebPush` per-token 로그 | 정상 | invalid token cleanup 흐름 유지 |
| SettingsScreen "다시 등록" 버튼 | 정상 | min-h 50px 터치 타겟, 텍스트 라벨 병행 — 접근성 기준 충족 |

### 🔴 발견된 이상 (수정 완료)

**onStatusUpdate — 신규 커플 첫 상태 등록 알림 누락 (회귀)**

- `if (!change.before.exists) return` 이 상태 문서 **최초 create를 무조건 skip**
- 상태 문서는 `useStatus.ts > updateMyStatus`(사용자가 직접 상태 등록)에서만 생성됨 → 첫 등록도 명백한 사용자 액션
- 결과: 신규 커플(또는 couple doc이 새로 만들어진 경우)의 **첫 상태 알림이 영구 누락**
- 수정: create는 알림 발송 유지, `before.exists`인 경우에만 무변경(condition/message/mood 동일) write skip

### 🟡 경미 (수정 완료)

- `getPartnerToken`의 `Object.entries(...).forEach(([deviceId, token])` — `deviceId` 미사용 변수 → `Object.values`로 정리

### 🟢 참고 (수정 불요, 기록만)

- `installPushTokenAutoSync`: 탭 복귀 시 `focus` + `visibilitychange` 둘 다 발화해 sync가 2회 실행될 수 있으나, `getToken`은 멱등이고 부하 미미 — 수정 불요
- 보고서의 원인 분석·QA 절차·핸드오프 체크리스트는 코드와 일치함을 확인

---

## 03. 변경된 파일

| 파일 경로 | 변경 내용 | 비고 |
|---|---|---|
| `functions/src/index.ts` | `onStatusUpdate` 첫 create 알림 복원 (무변경 skip은 유지) | 🔴 회귀 수정 |
| `functions/src/index.ts` | `Object.entries` → `Object.values` (미사용 변수 정리) | 🟡 정리 |
| `docs/claude-code-review-2026-06-13-push-hotfix-verification.md` | 본 보고서 | 신규 |

---

## 04. 검증

| 항목 | 결과 |
|---|---|
| `functions` TypeScript build (`npm run build`) | ✅ 통과 |
| 클라이언트 `npm run build` (Vite + PWA) | ✅ 통과 |
| 실기기 FCM E2E | ⚠️ 미실행 (소장님 수동 QA 필요 — 원본 보고서 §04 절차 동일) |

---

## 05. 특이점 / 결정사항

- "초기 create skip"은 원본 보고서에 의도된 변경으로 기재돼 있었으나, 상태 문서를 생성하는 코드 경로가 사용자 액션 1곳뿐이므로 회귀로 판정하고 수정함
- Functions 재배포는 프로덕션 영향이 있어 임의 실행하지 않음 — 최종 결정은 소장님

---

## 06. 남은 작업

- [ ] worktree 브랜치 `claude/nice-perlman-101d1d` → `main` 머지 (담당: 소장님)
- [ ] `firebase deploy --only functions:onStatusUpdate` 재배포 (담당: 소장님 / Cursor)
- [ ] 실기기 수동 QA — 원본 보고서 §04 절차 (담당: 소장님)
- [ ] 미해결 시 원본 보고서 §05 핸드오프 + Functions 로그 캡처로 재진입 (담당: Claude Code)

---

## 07. 핸드오프 메모

- Cursor에게: `onStatusUpdate`의 무변경 skip 조건을 다시 강화할 일이 있으면, 반드시 `before.exists` 분기 내부에서만 처리할 것 (create skip 금지)
- Codex에게: 신규 커플 시나리오(연결 직후 첫 상태 등록 → 파트너 알림 수신)를 검증 케이스에 추가 요청
- 주의사항: 이번 수정은 Functions만 변경 — Hosting 재배포 불필요

## 08. Git 커밋

- 커밋 해시: (커밋 후 기입 — 본 문서와 함께 커밋됨)
- 배포 여부: 미배포 (소장님 승인 대기)

---

*SVIL — Tether Push Hotfix 검수 | Claude Code | 2026.06.13*
