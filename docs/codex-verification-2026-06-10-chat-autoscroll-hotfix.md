# Codex Verification Report — Chat auto-scroll hotfix

- 검증일: 2026-06-10
- 대상: `src/screens/ChatScreen.tsx` 채팅 자동 스크롤 핫픽스
- 결과: 추가 수정 후 build 통과
- 보고 위치: Notion 미기록, 프로젝트 `docs/` 저장

## 01. 증상

채팅방 진입 시 마지막 메시지까지 자동 스크롤되지 않는 문제가 남아 있었다.

## 02. 확인한 원인

### P1 — 채팅 리스트가 실제 스크롤 컨테이너로 고정되지 않음

기존 루트는 `min-h-screen` 기반이라 메시지가 많을 때 `main` 내부가 스크롤되는 대신 화면 전체 높이가 늘어날 수 있다.

이 경우 `listRef.current.scrollTo(...)`를 호출해도 실제 사용자가 보는 위치가 맨 아래로 이동하지 않을 수 있다.

수정:

- 채팅 화면 루트에 `height: 100dvh`, `overflow-hidden` 적용
- 메시지 리스트 `main`에 `min-h-0` 추가
- `main`이 확실한 내부 스크롤 컨테이너가 되도록 고정

### P1 — 초기 스크롤 완료 전 `loadMore()`가 먼저 실행될 수 있음

초기 진입 직후에는 스크롤 위치가 top이므로 `topRef` sentinel이 보일 수 있다.

`IntersectionObserver`가 초기 맨 아래 스크롤보다 먼저 실행되면 이전 메시지 로드가 발생하고, `scrollTop = added` 위치 보존 로직이 초기 하단 스크롤을 무력화할 수 있다.

수정:

- `initialScrollDoneRef` 추가
- 초기 `requestAnimationFrame` 2회 후 하단 스크롤이 끝난 뒤에만 이전 메시지 로드 허용
- `IntersectionObserver`의 `root`를 viewport가 아니라 `listRef.current`로 지정

## 03. 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/screens/ChatScreen.tsx` | 내부 스크롤 컨테이너 고정, 초기 스크롤 완료 전 loadMore 차단, observer root 지정 |

## 04. 검증 결과

- `npm.cmd run build`: 통과

실제 계정 데이터가 있는 채팅방 진입 및 실기기 키보드 동작은 현재 검증 환경에서 직접 수행하지 않았다.

## 05. 실기기 확인 항목

- [ ] 채팅방 최초 진입 시 마지막 메시지가 보이는지
- [ ] 이전 메시지 로드 시 화면이 아래로 튀지 않는지
- [ ] 새 메시지 전송 시 입력 포커스 유지 + 즉시 하단 스크롤
- [ ] 상대 메시지 수신 시 smooth 하단 스크롤
- [ ] 이미지 메시지 포함 채팅방에서 이미지 로드 후 하단 위치 유지

## 06. 결론

기존 핫픽스는 마지막 메시지 id 기준 스크롤 방향은 맞았지만, 스크롤 컨테이너와 초기 `loadMore` 경쟁 조건 때문에 실제 진입 시 하단 이동이 실패할 수 있었다.

이번 수정으로 채팅 리스트가 명확한 내부 스크롤 영역이 되었고, 초기 하단 스크롤이 완료되기 전 이전 메시지 로드가 실행되지 않도록 막았다.

Codex 설계분석 체크리스트 확인 완료
