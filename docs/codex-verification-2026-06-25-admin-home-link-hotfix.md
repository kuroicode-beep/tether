제목: ✅ Codex 검증 보고서 — 관리자 홈 링크 핫픽스 (2026.06.25)
원본 작업지시문:
- 관리자 페이지 링크를 Log 버튼 옆에 추가
- `kuroicode@gmail.com` 로그인 시에만 표시

## 01. 작업 요약
- 목표: 홈 화면 상단에서 관리자 페이지로 바로 이동할 수 있는 진입점 제공
- 결과: 통과
- 소요 시간: 약 10분

## 02. 작업 로그
- [2026-06-25] 기존 관리자 라우트와 설정 화면 진입점 확인
- [2026-06-25] 홈 화면 Log 버튼 옆에 Admin 버튼 추가
- [2026-06-25] `SessionContext` 로그인 이메일과 `isAdminEmail()` 기준으로 노출 조건 적용

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `src/screens/HomeScreen.tsx` | 관리자 이메일 로그인 시 Log 옆 Admin 버튼 표시 | 홈 헤더 진입점 |
| `docs/codex-verification-2026-06-25-admin-home-link-hotfix.md` | 검증 보고서 추가 | 본 문서 |

## 04. 구현 결과
✅ 완료 항목:
- `kuroicode@gmail.com` 로그인 계정에서만 Admin 버튼 표시
- Admin 버튼 클릭 시 기존 `admin` 화면으로 이동
- 비관리자 계정에는 버튼 미노출

⚠️ 미완료 항목:
- 없음

## 05. 특이점 / 결정사항
- 관리자 권한 판정은 기존 `isAdminEmail()` 단일 기준을 재사용했다.
- 관리자 화면 자체는 이미 `AdminScreen`과 `App.tsx` 라우트에 구현되어 있어 홈 진입점만 추가했다.

## 06. 남은 작업
- [ ] 실기기에서 관리자 계정 로그인 후 Home > Admin 진입 확인 (담당: 소장님)

## 07. 핸드오프 메모
- Cursor에게: 홈 헤더 버튼 배치는 `Log` → `Admin` → 설정 순서다.
- Codex에게: 관리자 이메일 기준 변경 시 `src/lib/coupleAuth.ts`의 `ADMIN_EMAIL`만 수정하면 된다.
- 주의사항: 관리자 화면 접근 제어는 UI 표시와 Firestore rules 양쪽을 함께 유지해야 한다.

## 08. Git 커밋
- 커밋 해시: 커밋 후 확인
- 배포 여부: Firebase Hosting 배포 완료 (`https://tether-d1dab.web.app`)
