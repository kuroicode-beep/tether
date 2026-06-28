제목: ✅ Codex 검증 보고서 — v0.5.11 Web Push 종료 상태 알림 안정화 (2026.06.29)
원본 작업지시문:
- 앱이 종료될때 백그라운드에 머물게 해야되는건지 알림이 왔다 안왔다 해 이게 분명 토큰 문제는 아닌거 같거든?

## 01. 작업 요약
- 목표: 앱 종료/백그라운드 상태에서 알림 수신이 불안정한 원인을 점검하고, 토큰 외 알림 표시 경로를 보강한다.
- 결과: 통과
- 소요 시간: 약 25분

## 02. 작업 로그
- [2026.06.29] Service Worker, foreground FCM, token sync, Cloud Functions 발송 경로 확인
- [2026.06.29] 현재 구조가 `data-only + Service Worker 직접 표시`에 치우쳐 있음을 확인
- [2026.06.29] PWA는 앱 종료 시 백그라운드 상주를 강제할 수 없으므로 서버 payload를 OS/브라우저 표시 가능 형태로 보강
- [2026.06.29] `webpush.notification` payload 추가 및 `forceSwDisplay` 제거
- [2026.06.29] v0.5.11 버전/Log 반영
- [2026.06.29] lint/build/functions build 검증

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `functions/src/index.ts` | FCM Web Push 발송에 `webpush.notification` 추가, `forceSwDisplay` 제거 | 백그라운드/종료 상태 표시 안정화 |
| `src/lib/appVersion.ts` | 앱 버전 `0.5.11` 반영 | 단일 버전 소스 |
| `package.json` | 버전 `0.5.11` 반영 | 릴리즈 정합성 |
| `package-lock.json` | 루트 패키지 버전 `0.5.11` 반영 | 릴리즈 정합성 |
| `src/screens/ReleaseLogScreen.tsx` | v0.5.11 핫픽스 로그 추가 | 앱 내 Log |
| `docs/codex-verification-2026-06-29-v0-5-11-webpush-notification-payload.md` | 본 검증보고서 추가 | 신규 |

## 04. 구현 결과
✅ 완료 항목:
- 앱 종료 시 앱을 백그라운드에 강제 상주시킬 수 없다는 구조적 한계를 확인
- Functions 발송 payload에 브라우저/OS가 직접 표시할 수 있는 `webpush.notification` 추가
- 열린 앱에서는 기존 foreground/onMessage 및 Service Worker postMessage 중복 방지 경로 유지
- `notificationId` 기반 tag를 notification payload에도 유지해 중복 표시 가능성을 낮춤
- `npm run lint` 통과
- `npm run build` 통과
- `npm --prefix functions run build` 통과

⚠️ 미완료 항목:
- iOS/Android/PC 실기기에서 앱 완전 종료, hidden/minimized, visible 상태별 알림 QA는 필요하다.
- iOS PWA는 OS/브라우저 정책 영향이 있어 네이티브 앱처럼 백그라운드 상주 보장은 불가능하다.

## 05. 특이점 / 결정사항
- 이번 문제는 토큰 저장 자체보다는, 앱이 닫힌 상태에서 Service Worker가 즉시 깨워져 `showNotification()`을 실행해야 하는 구조의 취약성으로 판단했다.
- `data-only`를 유지하면서 `forceSwDisplay`로만 처리하면 SW 실행 경로가 흔들릴 때 알림이 누락될 수 있다.
- `webpush.notification`을 포함하면 브라우저/OS 기본 알림 표시 경로가 살아 있어 종료 상태에서 더 안정적이다.

## 06. 남은 작업
- [ ] Functions + Hosting 배포 후 실기기 알림 QA (담당: Codex/소장님)
- [ ] 설정 > Notifications > 다시 등록 후 self/partner 테스트 알림 확인 (담당: 소장님)
- [ ] iPhone PWA 완전 종료/잠금화면/홈화면 상태별 수신 기록 확인 (담당: 소장님)

## 07. 핸드오프 메모
- Cursor에게: 알림 안정화는 토큰만 보면 안 된다. payload에 notification이 포함되어 있는지, SW에서 중복 표시를 피하는지 같이 확인할 것.
- Codex에게: 중복 알림이 재발하면 `notificationId` tag와 foreground/onBackground 분기부터 다시 확인할 것.
- 주의사항: 앱을 백그라운드에 상주시키는 방식은 PWA에서 제어할 수 없다.

## 08. Git 커밋
- 커밋 해시: final 응답 기준 기재
- 배포 여부: final 응답 기준 기재
