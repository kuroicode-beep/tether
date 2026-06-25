# Tether v0.3.0 Step 3-6 완료보고서 — 표시·접근성·오프라인·릴리즈 정리

작성일: 2026-06-25
담당: Codex

## 01. 작업 요약

- 목표: v0.3.0 Step 3-6 표시 개선, 접근성 보강, Firestore 오프라인 캐시, 릴리즈 정리
- 결과: 부분통과
- 자동 검증: `npm run build` 통과, `firebase deploy --only firestore:rules --dry-run` 통과
- 보류: 실제 rules 배포, live E2E, hosting 배포, 실기기 QA

## 02. 구현 내용

### Step 3. Log 리포트 표시 문제 해결

변경 파일:

- `src/screens/ReleaseLogScreen.tsx`

반영:

- loading / empty / error / saving / pending 상태 표시
- 기능개선/버그 type chip 표시
- 열림/완료 status chip 표시
- 작성자 닉네임과 작성 시간 표시
- 완료/다시 열기 버튼 추가
- 작성자 삭제 버튼 추가
- 고대비 `hc-readable-box` 적용
- 입력창/버튼 최소 50px 터치 타겟 유지

### Step 4. 접근성 레이블·동적 알림 보강

변경 파일:

- `src/components/MoodChip.tsx`
- `src/components/MessageBubble.tsx`
- `src/components/ToastNotification.tsx`
- `src/components/ContentActionSheet.tsx`

반영:

- MoodChip에 기분 태그 및 선택 상태 `aria-label` 추가
- 채팅 말풍선에 보낸 사람/시간/내용/사진 여부 `aria-label` 추가
- 이미지 메시지 버튼/alt 문구 구체화
- Toast에 `role="status"`, `aria-live="polite"` 추가
- Toast 중첩 button 구조 제거
- Toast 닫기 버튼 `aria-label="알림 닫기"` 추가
- ContentActionSheet에 dialog role, modal 속성, Escape 닫기, 첫 액션 focus 적용

### Step 5. 오프라인 유지 기능 적용

변경 파일:

- `src/lib/firebase.ts`

반영:

- Firestore Web persistent local cache 적용
- multi-tab manager 적용
- 초기화 실패 시 기존 `getFirestore(app)` fallback

참고:

- Firebase 공식 문서 기준 Web 오프라인 persistence는 기본 비활성화이며, persistent local cache 설정으로 활성화한다.

### Step 6. v0.3.0 릴리즈 정리

변경 파일:

- `src/lib/appVersion.ts`
- `package.json`
- `package-lock.json`
- `src/screens/ReleaseLogScreen.tsx`
- `docs/spec-tether-v0.3.0.md`

반영:

- 앱 버전 `0.3.0`으로 갱신
- Log 최상단에 `Tether v0.3.0 업데이트.` 항목 추가
- v0.3.0 상세 스펙 문서 작성

## 03. 변경된 파일

| 파일 경로 | 변경 내용 | 비고 |
|---|---|---|
| `src/screens/ReleaseLogScreen.tsx` | 표시 상태, 고대비, v0.3.0 Log 항목 | 수정 |
| `src/components/MoodChip.tsx` | aria-label 추가 | 수정 |
| `src/components/MessageBubble.tsx` | 메시지 접근성 레이블 추가 | 수정 |
| `src/components/ToastNotification.tsx` | 동적 알림 role 및 중첩 button 제거 | 수정 |
| `src/components/ContentActionSheet.tsx` | dialog/focus/Escape 처리 | 수정 |
| `src/lib/firebase.ts` | Firestore persistent local cache 적용 | 수정 |
| `src/lib/appVersion.ts` | `0.3.0` | 수정 |
| `package.json` | `0.3.0` | 수정 |
| `package-lock.json` | `0.3.0` | 수정 |
| `docs/spec-tether-v0.3.0.md` | v0.3.0 상세 스펙 | 신규 |

## 04. 검증 결과

통과:

```bash
npm run build
firebase deploy --only firestore:rules --dry-run
```

보류:

```bash
npx tsx scripts/test-e2e-firebase.ts
firebase deploy --only firestore:rules
firebase deploy --only hosting
```

## 05. 남은 작업

- [ ] 프로덕션 rules 배포
- [ ] 배포 후 live E2E 실행
- [ ] hosting 배포
- [ ] PC/Android/iPhone 실기기 QA
- [ ] 실제 커플 계정으로 Log 리포트 동기화 확인
- [ ] 오프라인 작성 후 재연결 동기화 확인

## 06. 핸드오프 메모

Cursor에게:

- Step 3 UI는 현재 화면 내부에 구현되어 있다. 재사용성이 필요하면 `FeedbackReportCard`로 분리하면 된다.
- Toast 구조가 바뀌었으므로 클릭/닫기 이벤트 회귀를 실기기에서 확인해야 한다.

Codex에게:

- Firestore persistence 적용은 빌드 통과했지만, iOS PWA IndexedDB 동작은 실기기 확인이 필요하다.
- 실제 E2E는 rules 배포 뒤 실행해야 한다.

소장님에게:

- v0.3.0은 아직 자동 검증 통과 상태이며, 최종 완료는 배포 후 실기기 QA가 필요하다.

## 07. Git 커밋

- 커밋 해시: 미커밋
- 배포 여부: 미배포
