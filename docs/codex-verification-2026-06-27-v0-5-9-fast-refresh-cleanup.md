제목: ✅ Codex 검증 보고서 — v0.5.9 Fast Refresh 구조 정리 (2026.06.27)
원본 작업지시문:
- 전체 점검, 알림 안정화, 버그 수정, UI 편의성 강화

## 01. 작업 요약
- 목표: v0.5.8에서 남은 Fast Refresh lint 경고 4건을 제거하고, lint 게이트를 경고 없이 통과시키는 구조로 정리한다.
- 결과: 통과
- 소요 시간: 약 30분

## 02. 작업 로그
- [2026.06.27] Fast Refresh 경고 발생 파일 확인
- [2026.06.27] AppContext Provider와 `useApp` hook 분리
- [2026.06.27] SessionContext Provider와 `useSession` hook 분리
- [2026.06.27] UnreadBadges Provider와 `useUnreadBadges` hook 분리
- [2026.06.27] `useAuth` 하위 호환 hook과 `AuthProvider` 분리
- [2026.06.27] 관련 import 경로 정리
- [2026.06.27] v0.5.9 버전/Log 반영
- [2026.06.27] lint/build/audit/functions build 최종 검증

## 03. 변경된 파일
| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `src/context/AppContextCore.ts` | App context/type core 분리 | 신규 |
| `src/context/useApp.ts` | `useApp` hook 분리 | 신규 |
| `src/context/AppContext.tsx` | Provider-only 파일로 정리 | Fast Refresh |
| `src/context/SessionContextCore.ts` | Session context/type core 분리 | 신규 |
| `src/context/useSession.ts` | `useSession` hook 분리 | 신규 |
| `src/context/SessionContext.tsx` | Provider-only 파일로 정리 | Fast Refresh |
| `src/context/UnreadBadgesContextCore.ts` | unread badges context/type core 분리 | 신규 |
| `src/context/useUnreadBadges.ts` | `useUnreadBadges` hook 분리 | 신규 |
| `src/context/UnreadBadgesContext.tsx` | Provider-only 파일로 정리 | Fast Refresh |
| `src/hooks/AuthProvider.tsx` | 하위 호환 AuthProvider 분리 | 신규 |
| `src/hooks/useAuth.tsx` | hook-only 파일로 정리 | Fast Refresh |
| `src/**/*` import users | hook import 경로 갱신 | 구조 정리 |
| `src/lib/appVersion.ts` | 앱 버전 `0.5.9` 반영 | 단일 버전 소스 |
| `package.json` / `package-lock.json` | 버전 `0.5.9` 반영 | 릴리즈 정합성 |
| `src/screens/ReleaseLogScreen.tsx` | v0.5.9 핫픽스 로그 추가 | 앱 내 Log |

## 04. 구현 결과
✅ 완료 항목:
- `npm run lint` 경고 없이 통과
- Fast Refresh 구조 경고 4건 제거
- `npm run build` 통과
- `npm --prefix functions run build` 통과
- `npm audit --audit-level=high` 결과 0 vulnerabilities 확인
- v0.5.9 버전 및 Log 기록 반영

⚠️ 미완료 항목:
- 실기기 PC/iOS/Android 알림 시나리오는 별도 확인 필요
- Google 전용 가입 정책에 맞춘 live E2E 재작성은 아직 남아 있음

## 05. 특이점 / 결정사항
- Provider 컴포넌트 파일과 hook export 파일을 분리해 React Refresh 규칙에 맞췄다.
- context 객체와 타입은 `*Core.ts` 파일로 분리해 Provider와 hook이 같은 source of truth를 공유하게 했다.
- 기존 import 호환을 유지하기보다 lint/구조 안정성을 우선해 내부 import 경로를 명시적으로 갱신했다.

## 06. 남은 작업
- [ ] Google 전용 가입 정책 기반 live E2E 재작성 (담당: Codex/Cursor)
- [ ] PC/iOS/Android 알림 실기기 확인 (담당: 소장님)

## 07. 핸드오프 메모
- Cursor에게: context hook은 이제 `../context/useApp`, `../context/useSession`, `../context/useUnreadBadges`에서 가져와야 한다.
- Codex에게: 전체 자동 검증 게이트는 lint/build/functions build/audit 기준으로 통과한다. live E2E는 별도 재설계 필요.
- 주의사항: `*Context.tsx` 파일에 hook export를 다시 추가하면 Fast Refresh 경고가 재발한다.

## 08. Git 커밋
- 커밋 해시: final 응답 기준 기재
- 배포 여부: Firebase Hosting 배포 예정
