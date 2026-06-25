# ✅ Codex 검증 보고서 — v0.4.8 PC 알림 중복 핫픽스 (2026.06.26)

원본 작업지시문:
- PC에서 알림이 두번씩 와

## 01. 작업 요약
- 목표: PC에서 동일 푸시 알림이 두 번 표시될 수 있는 경로를 제거한다.
- 결과: 통과
- 소요 시간: 약 20분

## 02. 작업 로그
- [00:50] foreground FCM, service worker background notification, Cloud Functions payload 경로 확인
- [00:56] 앱 hidden 상태에서 React가 직접 `new Notification()`을 띄우는 경로 제거
- [01:00] 메시지/일기/댓글/테스트 알림에 안정적인 `notificationId` 추가
- [01:03] service worker 알림 교체 시 `renotify: false` 적용
- [01:07] v0.4.8 버전 및 Log 기록 추가
- [01:10] `npm run build`, `npm --prefix functions run build` 통과

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `src/App.tsx` | hidden 상태 직접 시스템 알림 제거 | SW 단일 표시로 통합 |
| `public/firebase-messaging-sw.js` | 같은 tag 교체 시 재알림 방지 | `renotify: false` |
| `functions/src/index.ts` | 이벤트별 stable `notificationId` 추가 | 중복 토큰 대응 |
| `src/lib/appVersion.ts` | v0.4.8 표기 | 핫픽스 버전 |
| `src/screens/ReleaseLogScreen.tsx` | v0.4.8 Log 추가 | 변경 기록 |
| `package.json`, `package-lock.json` | 패키지 버전 v0.4.8 | npm version |

## 04. 구현 결과
✅ 완료 항목:
- 앱이 visible일 때: toast + sound만 유지
- 앱이 hidden/background일 때: service worker system notification만 사용
- 같은 메시지/일기/댓글/테스트 이벤트가 중복 토큰으로 도착해도 같은 notification tag로 교체
- 교체 알림이 다시 울리지 않도록 `renotify: false` 적용
- v0.4.8 Log 기록 추가
- root build/functions build 통과

⚠️ 미완료 항목:
- 실제 PC 알림 중복 재현 테스트는 사용자 기기 알림 상태에서 확인 필요

## 05. 특이점 / 결정사항
- 기존 구조는 hidden 상태에서 앱 foreground handler가 직접 알림을 만들 수 있고, 동시에 service worker도 알림을 만들 수 있어 중복 가능성이 있었다.
- 또한 PC에 예전 FCM 토큰이 여러 개 남아 있으면 같은 이벤트가 여러 토큰으로 도착할 수 있어, 이벤트별 stable notificationId가 필요했다.

## 06. 남은 작업
- [ ] PC에서 새 메시지/테스트 알림 1회 표시 확인 (담당: 소장님)
- [ ] 계속 중복되면 설정의 “다시 등록”으로 PC 토큰을 재발급한 뒤 재확인 (담당: 소장님)

## 07. 핸드오프 메모
- Cursor에게: 알림 표시는 visible 앱은 toast/sound, hidden/background는 service worker 한 곳만 담당해야 한다.
- Codex에게: 중복이 계속되면 Firestore `users/{uid}.fcmTokens`의 PC device token 중복/잔존 상태를 점검한다.
- 주의사항: 기존 dirty 파일은 이번 작업 범위에서 제외한다.

## 08. Git 커밋
- 커밋 해시: 예정
- 배포 여부: `npm run build`, `npm --prefix functions run build` 통과, Firebase Functions/Hosting 배포 예정
