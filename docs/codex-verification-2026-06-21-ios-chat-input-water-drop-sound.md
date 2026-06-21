# ✅ Codex 검증 보고서 — iOS 채팅 입력·물방울 알림음 핫픽스 (2026.06.21)

원본 작업지시문:
- iPhone에서 메시지를 보내면 제일 끝 글자가 한 번 더 오는 문제 수정
- 알림 소리를 조금 큰 물방울 떨어지는 소리로 변경

## 01. 작업 요약
- 목표: iOS 한글 조합 입력 후 마지막 글자 잔류/중복 전송을 막고 알림음을 물방울 계열로 교체
- 결과: 통과
- 소요 시간: 약 15분

## 02. 작업 로그
- [19:04] `ChatInput`, `ChatScreen`, 알림음 생성 스크립트 확인
- [19:06] `contentEditable div` 입력창을 `textarea` 기반으로 전환
- [19:07] composition 중 Enter/Send 전송 차단 및 전송 후 DOM/state 동시 초기화 적용
- [19:08] 물방울 알림음 생성 스크립트 작성 및 `public/sounds/chime.wav` 재생성
- [19:10] Web Audio 폴백도 물방울 합성음으로 변경
- [19:11] `npm run build` 및 WAV 헤더 검증
- [19:12] Log 기록 추가

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `src/components/ChatInput.tsx` | 채팅 입력을 `textarea` 기반으로 전환, composition 중 전송 차단 | iOS 한글 입력 대응 |
| `scripts/generate-chime.mjs` | 물방울 알림음 WAV 생성 스크립트로 교체 | 기존 경로 유지 |
| `public/sounds/chime.wav` | 큰 물방울 계열 알림음으로 교체 | 1.15초, mono 44.1kHz |
| `src/lib/notificationAlert.ts` | 파일 재생 실패 시 Web Audio 물방울 폴백 적용 | 알림음 일관성 |
| `src/screens/ReleaseLogScreen.tsx` | Log 최상단에 핫픽스 기록 추가 | 사용자 안내 |

## 04. 구현 결과
✅ 완료 항목:
- iOS 한글 조합 중 Enter 전송 방지
- 전송 시 `textarea.value`와 React state를 함께 비워 마지막 글자 잔류 경로 차단
- 기존 `contentEditable`/`execCommand` 의존 제거
- 알림음 파일을 큰 물방울 느낌의 짧은 WAV로 교체
- Web Audio 폴백도 종소리에서 물방울 소리로 변경

⚠️ 미완료 항목:
- iPhone 실기기 한글 키보드 전송 검증은 소장님 QA 필요
- 실제 알림 수신음 체감은 기기 볼륨/OS 알림 정책 영향을 받으므로 실기기 확인 필요

## 05. 특이점 / 결정사항
- 원인은 iOS Safari/PWA의 `contentEditable` 한글 조합 이벤트가 전송 후 늦게 들어오며 마지막 글자를 다시 남기는 동작으로 판단했다.
- `textarea`는 모바일 IME 조합 처리 안정성이 더 높고, 기존 CSS가 이미 `textarea`를 지원하고 있어 UI 영향이 작다.
- 알림음 파일 경로는 `/sounds/chime.wav` 그대로 유지해 Service Worker precache와 앱 코드 변경 범위를 줄였다.

## 06. 남은 작업
- [ ] iPhone PWA에서 한글 메시지 전송 후 입력창에 마지막 글자가 남지 않는지 확인 (담당: 소장님)
- [ ] 내 기기 테스트 알림으로 물방울 소리 확인 (담당: 소장님)
- [ ] 파트너 테스트 알림으로 백그라운드 알림음 확인 (담당: 소장님)

## 07. 핸드오프 메모
- Cursor에게: 채팅 입력창을 다시 `contentEditable`로 되돌리지 말 것. iOS 한글 조합 입력 회귀 위험이 높다.
- Codex에게: 재검증 시 `안녕`, `고마워`, `편해?`처럼 끝 글자 조합이 남기 쉬운 한글 문장으로 테스트할 것.
- 주의사항: iOS는 브라우저/키보드 조합에 따라 composition 이벤트 순서가 다르므로 실기기 확인이 최종 기준이다.

## 08. Git 커밋
- 커밋 해시: `87f54e4` (`Fix iOS chat input and water drop alert sound`)
- 배포 여부: `firebase deploy --only hosting` 완료

## 검증 명령
- `npm run build` — 통과
- WAV 헤더 검증 — mono, 44.1kHz, 1.15초, 16-bit
- 배포 후 `/sounds/chime.wav` 조회 — 200 `audio/wav`, 101,472 bytes

Codex 설계분석 체크리스트 확인 완료
