# ✅ Codex 검증 보고서 — iOS IME 중복 전송 2차 차단·알림음 캐시 우회 (2026.06.21)

원본 작업지시문:
- iPhone에서 메시지 끝 글자가 여전히 한 번 더 전송됨
- 알림 소리도 그대로 들림

## 01. 작업 요약
- 목표: 입력 UI 레벨이 아니라 Firestore 전송 직전에서 iOS IME 꼬리 중복을 차단하고, 알림음 파일 캐시를 새 경로로 우회
- 결과: 통과
- 소요 시간: 약 15분

## 02. 작업 로그
- [19:17] 재현 화면 확인 및 기존 1차 수정 한계 분석
- [19:19] `useChat.sendText`에 직전 전송 문장의 마지막 1-2글자 중복 전송 차단 추가
- [19:21] 알림음 경로를 `/sounds/chime.wav`에서 `/sounds/water-drop-20260621.wav`로 변경
- [19:22] PWA precache 목록에 새 알림음 파일 추가
- [19:24] `npm run build` 및 WAV 헤더 검증
- [19:25] Log에 2차 핫픽스 기록 추가

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `src/hooks/useChat.ts` | 직전 전송 문장의 마지막 1-2글자만 3초 내 재전송되는 경우 스킵 | Firestore 쓰기 전 차단 |
| `src/lib/notificationAlert.ts` | 알림음 URL을 새 파일명으로 변경 | 캐시 우회 |
| `vite.config.ts` | 새 알림음 파일을 PWA includeAssets에 추가 | SW precache |
| `public/sounds/water-drop-20260621.wav` | 물방울 알림음 새 경로 추가 | 기존 chime 캐시 회피 |
| `src/screens/ReleaseLogScreen.tsx` | Log 최상단에 2차 핫픽스 기록 추가 | 사용자 안내 |

## 04. 구현 결과
✅ 완료 항목:
- `contentEditable` 수정만으로 막히지 않던 iOS IME 꼬리 중복을 `sendText` 레벨에서 차단
- `되었다` 직후 `다`, `요`, `오`처럼 마지막 1-2글자만 들어오는 패턴을 3초 안에서는 Firestore에 쓰지 않음
- 알림음 경로를 새 파일명으로 바꿔 기존 Service Worker/브라우저 캐시 회피
- 새 알림음 파일을 PWA precache에 포함

⚠️ 미완료 항목:
- Windows/Edge 시스템 토스트 자체의 기본 알림음은 웹앱에서 커스텀 WAV로 변경할 수 없음
- iPhone 실기기 한글 입력 재검증 필요

## 05. 특이점 / 결정사항
- 이번 중복 차단은 의도적인 한 글자 메시지까지 무조건 막지 않도록 `직전 문장의 끝 글자`, `1-2글자`, `3초 이내` 조건을 모두 만족할 때만 동작한다.
- 앱 내부 포그라운드 알림음은 새 물방울 WAV를 사용한다.
- OS/브라우저가 띄우는 파란 시스템 알림의 소리는 운영체제 기본 알림음이라 앱 파일로 교체되지 않는다.

## 06. 남은 작업
- [ ] iPhone PWA에서 `되었다`, `안고쳐진듯`, `고마워요` 전송 후 마지막 글자 단독 메시지가 생기지 않는지 확인 (담당: 소장님)
- [ ] 앱이 열린 상태에서 테스트 알림을 받아 물방울 소리 확인 (담당: 소장님)
- [ ] 백그라운드 시스템 알림은 OS 기본음임을 감안해 체감 확인 (담당: 소장님)

## 07. 핸드오프 메모
- Cursor에게: `useChat.sendText`의 IME 꼬리 중복 방어를 제거하지 말 것.
- Codex에게: 만약 여전히 중복이 생기면 Cloud Functions/Firestore 쪽이 아니라 클라이언트에서 실제로 두 번 `sendText`가 호출되는지 debugLog를 확인할 것.
- 주의사항: 사용자가 아주 빠르게 마지막 한 글자만 의도적으로 다시 보낼 경우 3초 안에는 스킵될 수 있다.

## 08. Git 커밋
- 커밋 해시: `26d5313` (`Block iOS trailing IME sends and bust alert sound cache`)
- 배포 여부: `firebase deploy --only hosting` 완료

## 검증 명령
- `npm run build` — 통과
- WAV 헤더 검증 — mono, 44.1kHz, 1.15초, 16-bit
- 배포 후 `/sounds/water-drop-20260621.wav` 조회 — 200 `audio/wav`, 101,472 bytes

Codex 설계분석 체크리스트 확인 완료
