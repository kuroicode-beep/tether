# ✅ Codex 검증 보고서 — v0.4.10 커플 공용 메인테마 음악 핫픽스 (2026.06.26)

원본 작업지시문:
- 음악 내가 메인테마 지정하면 상대한테도 나와야해.
- 마지막에 설정한 곡으로 둘 다 똑같이 나오게

## 01. 작업 요약
- 목표: 메인테마 음악을 기기별 설정이 아니라 커플 공용 설정으로 동기화한다.
- 결과: 통과
- 소요 시간: 약 15분

## 02. 작업 로그
- [01:50] 기존 localStorage 기반 테마곡 구조와 Firestore couples update rules 확인
- [01:55] `couples/{coupleId}.mainThemeTrack` 실시간 구독 추가
- [01:58] 메인테마 지정 시 Firestore merge write로 공용 테마곡 저장
- [02:00] localStorage source of truth 제거 및 마지막 지정 곡 기준 동기화
- [02:03] v0.4.10 버전 및 Log 기록 추가
- [02:05] `npm run build` 통과

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `src/App.tsx` | 메인테마곡 Firestore 구독/저장으로 변경 | 커플 공용 source of truth |
| `src/lib/appVersion.ts` | v0.4.10 표기 | 핫픽스 버전 |
| `src/screens/ReleaseLogScreen.tsx` | v0.4.10 Log 추가 | 변경 기록 |
| `package.json`, `package-lock.json` | 패키지 버전 v0.4.10 | npm version |

## 04. 구현 결과
✅ 완료 항목:
- 내가 메인테마로 지정한 음악이 `couples/{coupleId}.mainThemeTrack`에 저장됨
- 상대방 앱도 같은 couple 문서를 구독해 마지막 지정 곡을 표시
- 화면 이동 중 전역 플레이어 유지
- 기존 기기별 localStorage source of truth 제거
- `npm run build` 통과

⚠️ 미완료 항목:
- 브라우저 자동재생 정책상 상대방 기기에서 곡이 표시되어도 재생 시작은 사용자의 재생 버튼 입력이 필요할 수 있음.

## 05. 특이점 / 결정사항
- Firestore rules에서 couple 멤버는 `members` 필드를 제외한 couple 문서 update가 가능하므로 rules 변경 없이 적용했다.
- 닫기 버튼은 공용 상태를 실수로 지울 수 있어 전역 플레이어에서는 노출하지 않는다.

## 06. 남은 작업
- [ ] 한쪽에서 메인테마 지정 → 상대방 화면에 같은 제목 표시 확인 (담당: 소장님)
- [ ] 다른 곡으로 다시 지정 → 두 기기 모두 마지막 곡으로 교체 확인 (담당: 소장님)

## 07. 핸드오프 메모
- Cursor에게: 메인테마 삭제/초기화가 필요해지면 별도 명시 버튼과 공용 clear 정책을 설계해야 한다.
- Codex에게: 자동재생은 브라우저 정책 때문에 보장하지 않는다. 동기화 대상은 곡 선택 상태와 플레이어 표시다.
- 주의사항: 기존 dirty 파일은 이번 작업 범위에서 제외한다.

## 08. Git 커밋
- 커밋 해시: 예정
- 배포 여부: `npm run build` 통과, Firebase Hosting 배포 예정
