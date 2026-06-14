# ✅ 완료 보고서 — 알림 진단 ping·토큰 상태 배너·복구 새 연결 수정 (Cursor, 2026.06.12)

원본 작업지시문: push-notification-resync-v2 핸드오프 §05 + 복구 화면 새 연결 진행 후속  
기준 커밋: `c9b4bfa`  
작업 브랜치: `main`

## 01. 작업 요약

- 목표: 알림 미수신 진단 도구 추가, 토큰 미등록 in-app 안내, 복구 화면 새 연결 → 초대 코드 화면 직행
- 결과: 완료
- 소요 시간: 단기 핫픽스

## 02. 작업 로그

- `sendWebPush` 반환값을 `{ tokenCount, successCount, failureCount }`로 정리
- Callable `debugPushPing` 추가 (self/partner 테스트 multicast)
- `usePushTokenHealth` — permission granted + 현재 deviceId 미등록 감지 (3초 지연)
- `PushTokenHealthBanner` — 홈·설정 상단 안내 + 다시 등록
- 설정 — **내 기기 테스트 알림** / **상대방 테스트 알림** 버튼
- 복구 화면 — `새 연결 진행하기` 후 `create` 단계로 이동 (choice 중간 화면 제거)
- 복구 화면 버튼에 `hc-readable-box` 적용
- Log 페이지 항목 추가

## 03. 변경된 파일

| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `functions/src/index.ts` | `collectUserTokens`, `debugPushPing`, `sendWebPush` stats | Functions 배포 필요 |
| `src/lib/pushDiagnostics.ts` | callable 클라이언트 | 신규 |
| `src/hooks/usePushTokenHealth.ts` | Firestore fcmTokens 구독 | 신규 |
| `src/components/PushTokenHealthBanner.tsx` | 토큰 만료 안내 배너 | 신규 |
| `src/screens/HomeScreen.tsx` | 배너 표시 | |
| `src/screens/SettingsScreen.tsx` | 테스트 알림 + 배너 | |
| `src/screens/OnboardingScreen.tsx` | 새 연결 → create, HC 버튼 | |
| `src/screens/ReleaseLogScreen.tsx` | Log 항목 | |

## 04. 구현 결과

### ✅ 완료 항목

- debugPushPing callable (self/partner)
- 홈/설정 토큰 health 배너
- 설정 테스트 알림 UI
- 복구 새 연결 → 초대 코드 화면 직행
- `npm run build` 통과 예정

### ⚠️ 미완료 항목

- 실기기 FCM E2E QA (소장님 확인 필요)

## 05. 수동 QA 절차 (소장님)

1. 설정 → **다시 등록** 후 **내 기기 테스트 알림** 탭 → 알림 1건 수신
2. 상대 기기도 등록 후 **상대방 테스트 알림** 탭
3. Functions log: `[Push] debugPushPing result` + `successCount >= 1`
4. 복구 화면 → **새 연결 진행하기** → 초대 코드 화면 즉시 표시 확인

## 06. Git / 배포

- 커밋 해시: (배포 후 기록)
- Functions 배포: `debugPushPing` 포함
- Hosting 배포: 예

---

*SVIL — Tether Push Diagnostics v3 | Cursor | 2026.06.12*
