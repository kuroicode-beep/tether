# Codex 검증 보고서 - iOS PWA Push Notification Hotfix (2026.06.18)

원본 작업지시문:
- "아이폰에서 푸시알람 작동이 안돼. pc랑 안드로이드는 되고.. 다시 봐서 잘 점검하고 수정해줘"

## 01. 작업 요약

- 목표: PC/Android에서는 동작하지만 iPhone에서 수신되지 않는 PWA push 흐름 점검 및 수정
- 결과: 부분 통과
- 판정: 코드/빌드 검증 통과, 실기기 iPhone 수신 검증은 필요

## 02. 원인 분석

- 기존 서버 푸시 payload가 `data` 중심이었다.
- Firebase 공식 문서는 Safari/iOS까지 안정적으로 받으려면 notification payload와 `webpush.fcmOptions.link`를 함께 쓰는 방식을 안내한다.
- 기존 Settings UI는 iOS Safari 탭에서 `canRequestPushPermission()`이 false일 때 버튼이 사라져, 홈 화면 PWA 조건 미충족을 사용자가 알기 어려웠다.

## 03. 변경된 파일

| 파일 경로 | 변경 내용 |
|---|---|
| `functions/src/index.ts` | FCM 발송 payload에 top-level `notification` 및 `webpush.notification` 추가 |
| `public/firebase-messaging-sw.js` | FCM notification payload가 있는 경우 service worker 수동 표시를 건너뛰어 중복 알림 방지 |
| `src/hooks/usePushNotification.ts` | push permission 차단 사유 helper 추가 |
| `src/screens/SettingsScreen.tsx` | iOS Safari 탭 / 미지원 브라우저 안내 UI 추가 |

## 04. 구현 결과

완료 항목:
- iOS/Safari 친화적인 notification payload 추가
- 기존 data payload와 screen/url 딥링크 데이터 유지
- foreground toast 흐름 유지
- background notification 중복 표시 방지
- iOS 홈 화면 PWA 안내 표시

미완료 항목:
- iPhone 실기기 수신 검증
- 배포 후 홈 화면 PWA에서 다시 등록 및 테스트 알림 확인

## 05. 검증

- `npm run build` 통과
- `npm --prefix functions run build` 통과
- `dist/firebase-messaging-sw.js`에 Firebase env 치환 및 중복 방지 로직 반영 확인

## 06. 실기기 QA

- iPhone Safari에서 `tether-d1dab.web.app` 접속
- 공유 버튼 > 홈 화면에 추가
- 홈 화면 Tether 아이콘으로 실행
- 설정 > Notifications > 알림 허용 또는 다시 등록
- 내 기기 테스트 알림 실행
- 앱을 닫거나 백그라운드로 둔 상태에서 수신 확인

## 07. 배포

- [x] `firebase deploy --only functions,hosting`
- Hosting URL: https://tether-d1dab.web.app
- 배포 결과: 성공
- 참고: Firebase CLI가 `firebase-functions` 구버전 경고를 표시했지만 배포는 완료됨

## 08. 남은 작업

- [ ] iPhone PWA 실기기 테스트
- [ ] 실패 시 Firebase Functions 로그에서 iOS token send error code 확인

## 09. Git 커밋

- 커밋 해시: see git log
- 배포 여부: 완료
