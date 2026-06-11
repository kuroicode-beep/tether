# ✅ 완료 보고서 — 재연결 후 알림 토큰 재동기화 보강 (Cursor, 2026.06.12)

원본 작업지시문: 사용자 요청 — 재연결 이후 알림이 다시 오지 않는 문제 수정  
기준 커밋: `e03d943`  
작업 브랜치: `main`

## 01. 작업 요약

- 목표: 연결 해제 후 재연결한 계정/기기에서 FCM 토큰이 새 연결 상태로 확실히 재저장되도록 보강
- 결과: 완료
- 소요 시간: 단기 핫픽스

## 02. 작업 로그

- `onNewMessage`/`onStatusUpdate` Functions 로그가 정상 실행되는 것 확인
- 재연결이 같은 `uid`에서 발생하면 기존 토큰 동기화가 재실행되지 않을 수 있는 지점 확인
- 앱 루트 토큰 동기화 effect가 `session.coupleId`, `session.status` 변화에도 실행되도록 수정
- 연결 복원/새 코드 연결 직후 `syncPushTokenForUid(uid)` 호출 추가
- Functions 알림 발송에서 파트너 토큰이 없을 때 로그 추가
- multicast 발송 결과 token/success/failure count 로그 추가
- Log 페이지에 핫픽스 내역 추가

## 03. 변경된 파일

| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `src/hooks/usePushNotification.ts` | 권한 허용 기기 토큰 강제 재동기화 함수 추가 | |
| `src/App.tsx` | `coupleId/status` 변화에도 FCM 토큰 sync | |
| `src/screens/OnboardingScreen.tsx` | 복원/새 연결 성공 직후 토큰 sync | |
| `functions/src/index.ts` | 토큰 없음/발송 결과 로그 추가 | |
| `src/screens/ReleaseLogScreen.tsx` | Log 페이지 핫픽스 항목 추가 | |

## 04. 구현 결과

### ✅ 완료 항목

- 재연결 직후 현재 기기 FCM 토큰 재저장
- 같은 `uid`에서 새 `coupleId`가 생겨도 토큰 sync 재실행
- 서버에서 알림 발송 성공/실패 카운트 확인 가능
- 파트너 토큰 없음 상태 진단 가능

### ⚠️ 미완료 항목

- 실제 재연결 후 Android/iOS 알림 수신 QA 필요

## 05. 검증 결과

- `npm run build`: 통과
- `cd functions && npm run build`: 통과
- 실기기 QA: 미실행

## 06. 특이점 / 결정사항

- 재연결 자체는 같은 Firebase Auth UID로 일어날 수 있으므로, `uid` 변화만으로 토큰 동기화를 판단하면 부족하다. `coupleId/status` 변화도 동기화 트리거로 포함했다.

## 07. 남은 작업

- [ ] 재연결 후 양쪽 기기에서 앱 1회 열기
- [ ] PC → Android/iOS 메시지 발송 알림 확인
- [ ] Functions 로그에서 `multicast result` success/failure 확인

## 08. 핸드오프 메모

- 다음 작업: 배포 후 알림 테스트 재실행
- 주의사항: 모바일 PWA는 앱 재실행 후 토큰 저장을 확인해야 함

## 09. Git

- 커밋 해시: 미커밋
- push 여부: 아니오
- 배포 여부: 아니오
