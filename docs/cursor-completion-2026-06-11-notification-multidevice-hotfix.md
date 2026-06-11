# ✅ 완료 보고서 — 알림 미수신 멀티 디바이스 핫픽스 (Cursor, 2026.06.11)

원본 작업지시문: 사용자 요청 — "알람이 또 안와. 수정해줘"  
기준 커밋: `2f6b340`  
작업 브랜치: `main`

## 01. 작업 요약

- 목표: PWA 알림이 특정 기기에서 끊기는 문제 보강
- 결과: 완료
- 소요 시간: 단기 핫픽스

## 02. 작업 로그

- 기존 `users.fcmToken` 단일 저장 구조 확인
- 브라우저/PWA 설치 단위 `tether_push_device_id` 추가
- `users.fcmTokens.{deviceId}` 멀티 토큰 저장 추가
- Cloud Functions 알림 발송을 단일 토큰에서 multicast 발송으로 변경
- 무효 토큰 best-effort cleanup 추가
- Firestore rules에 `fcmTokens` self update 허용 추가

## 03. 변경된 파일

| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `src/hooks/usePushNotification.ts` | 기기별 stable push device id 생성 및 `fcmTokens` 저장 | 기존 `fcmToken`도 유지 |
| `functions/src/index.ts` | 파트너 모든 토큰으로 web push multicast 발송 | invalid token cleanup 포함 |
| `firestore.rules` | `users.fcmTokens` self update 허용 | rules dry-run 통과 |

## 04. 구현 결과

### ✅ 완료 항목

- PC/Android/iOS 등 여러 기기 토큰이 서로 덮어쓰지 않도록 보강
- 기존 단일 `fcmToken` 데이터도 fallback으로 계속 발송
- 메시지/status/diary 알림 모두 멀티 토큰 발송으로 통일
- 유효하지 않은 토큰은 Functions에서 가능한 경우 정리

### ⚠️ 미완료 항목

- Android/iOS 실기기 push 수신 QA는 소장님 확인 필요
- 기존에 이미 덮어써진 기기는 해당 기기에서 앱을 한 번 열어 토큰 재동기화 필요

## 05. 검증 결과

- `npm run build`: 통과
- `cd functions && npm run build`: 통과
- `firebase deploy --only firestore:rules --dry-run`: 통과
- 실기기 QA: 미실행

## 06. 특이점 / 결정사항

- 알림 미수신의 핵심 원인은 단일 `fcmToken`이 마지막 접속 기기 토큰으로 덮이는 구조로 판단했다.
- 호환성을 위해 `fcmToken`은 제거하지 않고 `fcmTokens`와 함께 유지한다.

## 07. 남은 작업

- [ ] Android PWA에서 앱 1회 실행 후 PC에서 메시지 전송 테스트
- [ ] iOS standalone PWA에서 앱 1회 실행 후 알림 권한/수신 테스트

## 08. 핸드오프 메모

- Codex에게: `fcmTokens` rules 허용 범위와 multicast cleanup 로직 검증 권장
- 다음 작업: 실기기 알림 수신 QA
- 주의사항: 배포 후 각 기기가 앱을 한 번 열어야 새 `fcmTokens.{deviceId}`가 저장된다.

## 09. Git

- 커밋 해시: 미커밋
- push 여부: 아니오
- 배포 여부: 아니오 (Functions/Rules/Hosting 배포 필요)
