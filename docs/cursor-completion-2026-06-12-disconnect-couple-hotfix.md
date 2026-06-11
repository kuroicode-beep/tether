# ✅ 완료 보고서 — 커플 연결 해제 핫픽스 (Cursor, 2026.06.12)

원본 작업지시문: 사용자 요청 — 설정의 연결 해제가 안 되는 문제 우선 수정  
기준 커밋: `37b5918`  
작업 브랜치: `main`

## 01. 작업 요약

- 목표: 설정의 연결 해제가 로컬 상태뿐 아니라 Firestore 계정 연결 상태에도 실제 반영되도록 수정
- 결과: 완료
- 소요 시간: 단기 핫픽스

## 02. 작업 로그

- 기존 연결 해제가 `AppContext.disconnect()`만 호출해 로컬 캐시만 비우는 문제 확인
- Cloud Function `disconnectCouple` 추가
- Admin SDK transaction으로 현재 couple members의 `users/{uid}.coupleId`를 null 처리
- `couples/{coupleId}`에는 `isDisconnected`, `disconnectedAt`, `disconnectedBy` 마킹
- 클라이언트 callable `disconnectCouple()` 추가
- 설정 화면 연결 해제 확인 시 서버 함수 호출 후 로컬 상태 정리
- 진행 중/오류 메시지 UI 추가
- Log 페이지에 핫픽스 내역 추가

## 03. 변경된 파일

| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `functions/src/index.ts` | `disconnectCouple` callable 추가 | 양쪽 users coupleId null |
| `src/lib/coupleAuth.ts` | 클라이언트 callable wrapper 추가 | |
| `src/screens/SettingsScreen.tsx` | 연결 해제 버튼을 서버 해제 함수와 연결 | |
| `src/screens/ReleaseLogScreen.tsx` | Log 페이지 핫픽스 내역 추가 | |

## 04. 구현 결과

### ✅ 완료 항목

- 연결 해제 시 양쪽 사용자 문서의 `coupleId` 제거
- 연결 해제 후 세션 스냅샷이 다시 connected로 복원되는 문제 방지
- 기존 채팅/일기/사진 데이터는 삭제하지 않고 커플 문서에 해제 마킹만 남김
- 설정 화면에 해제 중/실패 상태 표시

### ⚠️ 미완료 항목

- 실제 양쪽 계정 실기기 연결 해제 QA 필요

## 05. 검증 결과

- `npm run build`: 통과
- `cd functions && npm run build`: 통과
- 실기기 QA: 미실행

## 06. 특이점 / 결정사항

- 데이터 삭제가 아니라 계정 연결 해제만 수행한다. 데이터 삭제는 별도 명시 요청이 있을 때만 다뤄야 한다.
- 클라이언트 rules상 `coupleId` 변경은 차단되어 있으므로 Admin SDK callable로 처리한다.

## 07. 남은 작업

- [ ] 양쪽 계정에서 연결 해제 후 재로그인/재설치 복구 화면 확인

## 08. 핸드오프 메모

- 다음 작업: 배포 후 설정 > 연결 해제 실기기 테스트
- 주의사항: Functions 배포 필요

## 09. Git

- 커밋 해시: `99ceb9a`
- push 여부: 예 (`origin/main`)
- 배포 여부: 예 (`functions`, `hosting`)
