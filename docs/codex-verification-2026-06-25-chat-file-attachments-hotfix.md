제목: ✅ Codex 검증 보고서 — 채팅 파일/음악 첨부 핫픽스 (2026.06.25)
원본 작업지시문:
- 채팅창에 zip/문서 등 일반 파일과 mp3/m4a 등 음악 파일을 넣을 수 있게
- 일반 파일은 누르면 해당 프로그램과 연결하거나 다운로드
- 음악 파일은 바로 재생

## 01. 작업 요약
- 목표: 채팅 첨부를 이미지 전용에서 일반 파일/오디오 파일까지 확장
- 결과: 통과
- 소요 시간: 약 30분

## 02. 작업 로그
- [2026-06-25] 기존 채팅 메시지 타입이 `text | image`인 구조 확인
- [2026-06-25] `file` 메시지 타입과 `fileUrl`, `fileName`, `fileType`, `fileSize` 필드 추가
- [2026-06-25] 채팅 입력 파일 선택 범위를 이미지/오디오/문서/압축 파일로 확장
- [2026-06-25] 오디오 파일은 채팅 말풍선 안에서 재생, 일반 파일은 열기/다운로드 링크 제공
- [2026-06-25] Storage `couples/{coupleId}/files/{uid}/...` 업로드 규칙 추가
- [2026-06-25] 파일 메시지 알림 문구 보강
- [2026-06-25] 앱/Functions 빌드 및 Storage rules dry-run 검증
- [2026-06-25] Hosting + Functions + Storage rules 배포

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `src/hooks/useChat.ts` | `file` 메시지 타입, 파일 업로드, optimistic 처리 추가 | 채팅 데이터 |
| `src/components/ChatInput.tsx` | 파일 첨부 입력/미리보기/전송 처리 확장 | 입력 UI |
| `src/components/MessageBubble.tsx` | 오디오 재생 및 파일 열기/다운로드 카드 추가 | 말풍선 UI |
| `src/screens/ChatScreen.tsx` | `sendFile` 연결 | 화면 연결 |
| `src/styles/tokens.css` | 파일 카드/오디오 플레이어 스타일 추가 | UI/고대비 |
| `functions/src/index.ts` | 파일 메시지 알림 본문 추가 | 알림 |
| `storage.rules` | 채팅 파일 업로드 경로 허용 | Storage |
| `docs/codex-verification-2026-06-25-chat-file-attachments-hotfix.md` | 검증 보고서 추가 | 본 문서 |

## 04. 구현 결과
✅ 완료 항목:
- 채팅에서 이미지 외 파일 선택 가능
- zip/pdf/doc/xls/ppt/txt/hwp/hwpx/csv/json 및 오디오 파일 선택 허용
- mp3/m4a 등 오디오 파일은 채팅 안에서 바로 재생
- 일반 파일은 열기/다운로드 링크 제공
- 파일 메시지도 알림에 파일명을 표시
- 새 Storage 파일 경로 배포 완료

⚠️ 미완료 항목:
- iOS/Android 실기기에서 각 파일 앱 연결 동작 확인 필요

## 05. 특이점 / 결정사항
- 이미지는 기존 사진 메시지 UX와 사진첩 저장 기능을 유지하기 위해 기존 `image` 타입으로 계속 전송한다.
- 비이미지 파일만 새 `file` 타입으로 저장한다.
- 브라우저/OS가 지원하는 파일은 새 탭 또는 연결 앱으로 열리고, 그 외 파일은 다운로드된다.

## 06. 남은 작업
- [ ] iPhone에서 m4a/mp3 재생 확인 (담당: 소장님)
- [ ] Android에서 zip/pdf/doc 다운로드 또는 연결 앱 열기 확인 (담당: 소장님)
- [ ] 필요 시 파일 용량 제한 정책 추가 (담당: Codex/Cursor)

## 07. 핸드오프 메모
- Cursor에게: 파일 메시지 필드는 `fileUrl`, `fileName`, `fileType`, `fileSize`다.
- Codex에게: Storage 경로는 `couples/{coupleId}/files/{uploaderUid}/{filename}`이다.
- 주의사항: 이미지 파일은 `file`이 아니라 기존 `image` 메시지로 처리된다.

## 08. Git 커밋
- 커밋 해시: `1c4f388`
- 배포 여부: Firebase Hosting + Functions + Storage rules 배포 완료 (`https://tether-d1dab.web.app`)
