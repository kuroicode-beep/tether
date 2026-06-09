# ✅ 완료 보고서 — Tether 안정화 Step 2 Read/Badge 모델 정리 (Cursor, 2026.05.29)

원본 작업지시문: `docs/implementation-work-instructions-2026-06-09.md` §Step 2
기준 커밋: bdd2a70
작업 브랜치: main

## 01. 작업 요약

- 목표: 읽었는데 배지가 남거나, 보지 않았는데 배지가 사라지는 Read/Badge 불일치 제거
- 결과: 완료
- 소요 시간: 약 40분

## 02. 작업 로그

- `UnreadBadgesContext`: chat → `readBy`, diary → `isRead`, contents → `lastRead.contents` (legacy `more` 폴백)
- `BottomNav` Option B: more 탭에 contents 배지 표시, Settings 진입 시 `markTabRead` 호출 제거
- `ChatScreen`: `markTabRead('chat')` 제거, `markingReadRef` + `markManyAsRead` 배치 처리
- `DiaryScreen`: `markTabRead('diary')` 제거 — 카드 열람 시 `markDiaryRead`만 배지 해제
- `ContentsScreen`: `markTabRead('contents')` 로 변경
- `firestore.rules`: 수신자는 `readBy`만, 발신자는 `text`/`editedAt`만 수정 가능

## 03. 변경된 파일

| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `src/context/UnreadBadgesContext.tsx` | NavTab `contents`, readBy/isRead/lastRead.contents 기준 | 핵심 |
| `src/components/BottomNav.tsx` | more→contents 배지, navigate 시 markTabRead 제거 | Option B |
| `src/screens/ChatScreen.tsx` | readBy 기반 읽음, 중복 방지 ref | |
| `src/screens/DiaryScreen.tsx` | markTabRead 제거 | |
| `src/screens/ContentsScreen.tsx` | markTabRead('contents') | |
| `src/hooks/useChat.ts` | `markManyAsRead` writeBatch | |
| `firestore.rules` | messages update 필드 제한 강화 | |

## 04. 구현 결과

### ✅ 완료 항목

- Chat 배지: `readBy` 미포함 메시지 수 기준 (lastRead.chat 제거)
- Diary 배지: `isRead !== true` 기준 유지, 목록 진입만으로 배지 해제 안 함
- Contents 배지: `lastRead.contents` 기준, Settings 진입 시 해제 안 함
- 채팅 읽음: writeBatch + pending Set으로 중복 write 방지
- Firestore rules: 파트너 `readBy` / `isRead` 갱신 허용, 필드 범위 제한

### ⚠️ 미완료 항목

- 실기기 QA — 소장님 확인 필요
- `firestore.rules` 배포 — `firebase deploy --only firestore:rules` 별도 실행 필요
- Step 3 (users read 제한, coupleId 클라이언트 수정 금지 등) — 다음 단계

## 05. 검증 결과

- `npm run build`: 통과

## 06. 특이점 / 결정사항

- Option B 채택: BottomNav `more` UI 유지, 내부 배지 키는 `contents`
- `lastRead.more` → `lastRead.contents` 마이그레이션: 읽기 시 legacy `more` 타임스탬프 폴백
- `markTabRead`는 contents 전용 noop 외 탭은 즉시 return

## 07. 남은 작업

- [ ] Firestore rules 배포 (담당: 소장님 / Cursor)
- [ ] 실기기 QA: 채팅/일기/Settings·Contents 배지 시나리오 (담당: 소장님)
- [ ] Step 3 Firestore rules ownership 강화 (담당: Cursor)

## 08. 핸드오프 메모

- Codex에게: Step 2 완료 조건 4항목 실기기 검증 + rules 배포 후 재검증 요청
- 다음 작업: Step 3 — `docs/implementation-work-instructions-2026-06-09.md` §Step 3
- 주의: rules 배포 전 프로덕션에서 sender 메시지 수정·readBy 갱신 동작 확인

## 09. Git

- 커밋 해시: (미커밋)
- push 여부: 아니오
- 배포 여부: hosting 미배포, rules 미배포
