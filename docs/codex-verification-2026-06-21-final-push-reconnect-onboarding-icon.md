# ✅ Codex 검증 보고서 — 최종 알림·재연결·아이콘·온보딩 핫픽스 (2026.06.21)

원본 작업지시문:
- 재설치 후 다시 연결할 때 알림 토큰을 새로 생성해서 양쪽이 연결되게 수정
- iPhone 푸시 알림 미작동 재점검 및 수정
- 첨부 이미지로 앱 아이콘 교체
- 닉네임 시작 시 무한반복 수정
- Log에 최종 업데이트 기록

## 01. 작업 요약
- 목표: 재설치/재연결 후 iOS PWA 포함 Web Push 등록 경로를 안정화하고, 온보딩 루프와 앱 아이콘을 함께 정리
- 결과: 통과
- 소요 시간: 약 30분

## 02. 작업 로그
- [18:00] 알림 토큰, 온보딩, 세션, Functions, Log, 아이콘 생성 경로 확인
- [18:04] 재연결/다시 등록 시 FCM 토큰 강제 재발급 경로 추가
- [18:08] 닉네임 시작 중 온보딩 재마운트로 입력 상태가 날아가는 문제 수정
- [18:11] Functions Web Push payload를 Service Worker 직접 표시 방식으로 보강
- [18:14] 첨부 이미지를 앱 아이콘 소스로 반영하고 PWA 아이콘 재생성
- [18:17] Log 최상단에 최종 업데이트 기록 추가
- [18:22] 앱/Functions 빌드 및 Hosting/Functions 배포
- [18:25] 배포된 SW/manifest/icon 직접 조회 확인

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `src/lib/pushTokenSync.ts` | `deleteToken` 기반 강제 토큰 재발급 및 현재 deviceId 슬롯 정리 추가 | 재설치/재연결 대응 |
| `src/hooks/usePushNotification.ts` | `syncToken(true)` 강제 재발급 옵션 연결 | 설정 다시 등록 대응 |
| `src/hooks/usePushTokenHealth.ts` | 토큰 상태 배너의 재등록도 강제 재발급으로 변경 | 만료 토큰 대응 |
| `src/screens/OnboardingScreen.tsx` | 닉네임 시작 pending 복구 및 연결 성공 시 토큰 강제 재발급 | 무한반복 수정 |
| `src/screens/SettingsScreen.tsx` | 다시 등록 안내 문구를 새 토큰 발급 기준으로 변경 | 사용자 안내 |
| `functions/src/index.ts` | Web Push를 data 중심 payload + `forceSwDisplay`로 변경 | iOS PWA SW 표시 보강 |
| `src/screens/ReleaseLogScreen.tsx` | 2026.06.21 최종 업데이트 Log 추가 | 사용자 안내 |
| `assets/brand-logo-source.png` | 첨부 이미지로 아이콘 소스 교체 | 신규 아이콘 |
| `public/icon-*.png`, `public/apple-touch-icon.png`, `public/favicon.ico`, `public/icon.svg` | PWA/Apple/maskable/favicon 재생성 | 설치 아이콘 |

## 04. 구현 결과
✅ 완료 항목:
- 재연결/복원/초대 claim 성공 시 현재 설치의 FCM 토큰을 강제로 새로 발급해 저장
- 설정 > Notifications > 다시 등록 버튼도 강제 재발급으로 변경
- 토큰 상태 배너의 다시 등록도 강제 재발급으로 변경
- iOS PWA 백그라운드 알림이 SW `showNotification()` 경로를 타도록 Functions payload 보강
- 닉네임만으로 시작 시 세션 로딩 때문에 온보딩이 재마운트되어도 입력 닉네임을 복구
- 첨부 이미지 기반으로 PWA/Apple/maskable/favicon 아이콘 재생성
- Log 최상단에 최종 업데이트 및 테스트 방법 기록

⚠️ 미완료 항목:
- iPhone 실기기 수신 확인은 원격 자동화가 불가하여 소장님 실기기 QA 필요

## 05. 특이점 / 결정사항
- 기존 문제의 핵심은 두 가지였다.
  - 닉네임 시작: 익명 로그인 중 `loading → no_couple` 라우팅으로 온보딩 컴포넌트가 재마운트되어 로컬 step/nickname이 초기화됨
  - 알림: 재설치/재연결 시 기존 FCM 토큰 재사용/단순 재저장 경로가 남아 있고, 백그라운드 표시가 FCM notification 자동 표시 경로와 SW 직접 표시 경로 사이에서 애매했음
- 이번 수정은 iOS PWA에서 가장 명확하게 동작하도록 data payload + SW 직접 표시 방식을 선택했다.
- Firebase CLI 배포 중 `firebase-functions` 버전 업데이트 권고가 있었으나 배포는 정상 완료됐다.

## 06. 남은 작업
- [ ] iPhone 홈 화면 PWA에서 알림 권한 허용 및 다시 등록 테스트 (담당: 소장님)
- [ ] 상대방 테스트 알림 성공 여부 확인 (담당: 소장님)
- [ ] 실제 채팅/상태/일기 이벤트로 백그라운드 알림 확인 (담당: 소장님)

## 07. 핸드오프 메모
- Cursor에게: 이번 알림 경로는 `resetAndSyncPushTokenForUid()`를 기준으로 유지할 것. 다시 등록 버튼을 단순 `getToken()` 저장으로 되돌리지 말 것.
- Codex에게: iOS 알림 재검증 시 SW 직접 표시 여부, `users/{uid}.fcmTokens`, Functions `multicast result` 로그를 함께 확인할 것.
- 주의사항: iPhone은 Safari 탭이 아니라 홈 화면에 추가한 standalone PWA에서만 알림 권한 요청이 가능하다.

## 08. Git 커밋
- 커밋 해시: COMMIT_PENDING
- 배포 여부: `firebase deploy --only functions,hosting` 완료

## 검증 명령
- `npm run build` — 통과
- `npm run build` in `functions/` — 통과
- 아이콘 산출물 크기 확인 — 192/512/180/maskable 정상
- `firebase deploy --only functions,hosting` — 통과
- 배포 후 `https://tether-d1dab.web.app/firebase-messaging-sw.js` 조회 — env 치환 및 `showNotification()` 확인
- 배포 후 `https://tether-d1dab.web.app/icon-192.png` 조회 — 200 `image/png`

Codex 설계분석 체크리스트 확인 완료
