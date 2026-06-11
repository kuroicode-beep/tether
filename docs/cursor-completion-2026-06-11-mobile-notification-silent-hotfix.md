# ✅ 완료 보고서 — 모바일 백그라운드 알림 표시 핫픽스 (Cursor, 2026.06.11)

원본 작업지시문: 사용자 요청 — "pc에는 알람이 오는데 스마트폰에선 안와. 원래 잘 됐던건데 다시 한번 봐봐"  
기준 커밋: `b718ee0`  
작업 브랜치: `main`

## 01. 작업 요약

- 목표: PC에는 알림이 오지만 스마트폰 PWA에서 알림이 체감되지 않는 문제 보강
- 결과: 완료
- 소요 시간: 단기 핫픽스

## 02. 작업 로그

- `onNewMessage` Functions 로그 확인: 최근 메시지 트리거는 `ok`로 종료
- 서버 발송보다는 스마트폰 Service Worker 알림 표시 옵션 문제로 판단
- `public/firebase-messaging-sw.js`의 백그라운드 알림 `silent: hasClient` 제거
- 열린 client가 있어도 Android/PWA에서 소리·진동 알림이 표시되도록 `silent: false` 고정

## 03. 변경된 파일

| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `public/firebase-messaging-sw.js` | 백그라운드 알림 `silent` 옵션을 항상 `false`로 변경 | Android PWA 알림 체감 보강 |

## 04. 구현 결과

### ✅ 완료 항목

- 앱 client가 백그라운드에 남아 있어도 알림이 조용한 알림으로 내려가지 않도록 보강
- 기존 클릭 딥링크와 `PLAY_NOTIFICATION_SOUND` 메시지 흐름 유지
- 앱 빌드 통과

### ⚠️ 미완료 항목

- Android/iOS 실제 알림 수신 QA는 소장님 확인 필요

## 05. 검증 결과

- `npm run build`: 통과
- `firebase functions:log --only onNewMessage -n 30`: 최근 실행 `ok` 확인
- 실기기 QA: 미실행

## 06. 특이점 / 결정사항

- PC 알림이 온다는 점에서 Cloud Functions 발송 자체는 정상으로 판단했다.
- 모바일에서 앱이 background client로 남아 있으면 기존 `silent: hasClient`가 Android 알림을 조용하게 만들 수 있어 제거했다.

## 07. 남은 작업

- [ ] Android PWA에서 앱 1회 실행 후 PC에서 메시지 전송 테스트
- [ ] OS 알림 설정에서 Tether/Chrome 알림 채널이 무음인지 확인

## 08. 핸드오프 메모

- 다음 작업: 커밋·푸시·hosting 배포 후 스마트폰에서 앱 새로 열어 SW 갱신 확인
- 주의사항: Service Worker 갱신 때문에 배포 직후 스마트폰에서 앱을 완전히 닫고 다시 여는 것이 좋다.

## 09. Git

- 커밋 해시: 미커밋
- push 여부: 아니오
- 배포 여부: 아니오
