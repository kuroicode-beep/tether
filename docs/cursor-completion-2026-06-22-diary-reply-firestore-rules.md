# 완료 보고서 - 교환일기 답장 저장 불가 수정 (Cursor, 2026.06.22)

원본 작업지시문: 사용자 요청 — 교환일기 댓글(답장) 안 됨  
기준 커밋: `50ccb69`  
작업 브랜치: `main`

## 01. 작업 요약

- 목표: 상대방 교환일기에 답장(댓글)이 저장되지 않는 문제 수정
- 결과: 완료 (Firestore rules + 클라이언트 오류 표시)
- 소요 시간: 단기 핫픽스

## 02. 원인

Firestore `couples/{coupleId}/diary/{diaryId}` update 규칙이 **작성자만 update 허용** + **partner는 isRead만 변경**으로 제한되어 있었습니다.  
`writeReply()`는 partner가 `reply` 필드를 `updateDoc`하는데, rules에서 `permission-denied`로 거부되었습니다.

## 03. 변경된 파일

| 파일 경로 | 변경 내용 |
|----------|----------|
| `firestore.rules` | `isDiaryReplyCreate()` — partner 1회 reply 작성 허용 |
| `src/hooks/useDiary.ts` | `writeReply` boolean 반환 |
| `src/screens/DiaryScreen.tsx` | 답장 실패 오류 문구, 성공 시 읽기 화면 유지 |
| `src/screens/ReleaseLogScreen.tsx` | Log 항목 추가 |

## 04. 검증

- `npm run build`: 통과
- `firebase deploy --only firestore:rules --dry-run`: rules 컴파일 통과
- 실기기 QA: 배포 후 확인 필요

## 05. Git / 배포

- 커밋 해시: (배포 후 기록)
- 배포: `firestore:rules` + `hosting` 필요

## 06. 핸드오프

- 양쪽 기기 새로고침 후 상대 일기 → **답장 쓰기** → 저장 → 작성자 기기에서 답장 표시 확인
