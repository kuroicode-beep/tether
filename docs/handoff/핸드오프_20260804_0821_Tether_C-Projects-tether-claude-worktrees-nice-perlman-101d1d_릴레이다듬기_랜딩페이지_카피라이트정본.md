## 대상
- 프로젝트: Tether (커플 전용 PWA, React + Vite + TS + Firebase)
- 작업 폴더: C:\Projects\tether\.claude\worktrees\nice-perlman-101d1d (worktree, 브랜치 `claude/chat-caption-ios-kb` = `main`)
- 세션 시각: 2026-08-04 08:21 (KST)

## 세션 요약
같은 세션의 2차 체크포인트다. 1차(v0.7.0~v0.14.1, 핸드오프 20260803) 이후 릴레이소설 실사용 피드백 반영 → 로그인 화면 설치 안내 → 앱 소개 랜딩 페이지 → SVIL 카피라이트 정본 구조화 → Ghost 소개글 발행까지 진행했다. 앱 버전 v0.14.1 → v0.17.0, 커밋 8개.

## 완료된 작업

### 릴레이소설 다듬기 (v0.14.2 ~ v0.15.2)
- v0.14.2 — 턴 삭제 시 소설 문서에서도 턴 제거, 마지막 턴이면 차례 반환 (`src/screens/ChatScreen.tsx` `handleDeleteMessage`, `src/hooks/useRelayNovel.ts` `removeTurn`)
- v0.15.0 — `/릴소 보기` 신설, 진행 중에도 전문 열람 (`src/components/RelayNovelReadSheet.tsx`)
- v0.15.1 — 도움말 목적별 재구성, 별칭(`명령어`·`?`·`help`) 추가, 오타는 도움말로 유도, `/릴레이 소설` 띄어쓴 형태 인식
- v0.15.2 — Shift+Enter 줄바꿈 보존. 원인은 인자를 `split(/\s+/)` 후 공백으로 재결합한 것. 첫 낱말만 떼고 나머지 원문 유지로 수정 (`src/lib/relayNovel.ts`)

### 로그인 화면 설치 안내 (v0.16.0)
- `src/components/InstallGuide.tsx` 신설. iOS / Android / macOS / Windows 4탭 접이식, 접속 기기 탭이 먼저 열림
- 설치법보다 **알림·전원 설정** 위주 (1차 체크포인트에서 확인된 알림 미수신 원인이 거기 있었음)
- 본문 16px, 대비 8.7:1, 터치 타겟 73px, 선택 상태 텍스트 병기

### 앱 소개 랜딩 페이지 (v0.17.0)
- https://tether-d1dab.web.app/landing/ — `public/landing/index.html` 단일 파일(약 66KB), 외부 CDN·폰트·스크립트 0
- 5개 언어(en/ko/ja/zh/vi) 키 106개 전부 일치, en 폴백. 본문 18px / 최소 12px (소장님 지시로 16px 하한 해제)
- 구성: 히어로 → 기능 카드 6 → 기능 상세 5블록 → 가입 절차 4단계 + 승인 대기 → 기기별 알림 4탭 → 프라이버시 → CTA
- 스크린샷은 `public/landing/shots/`에 파일을 넣으면 자동 표시, 없으면 자리 숨김 (`README.md`에 파일명·촬영법·개인정보 주의 명시)
- 부수 수정: `vite.config.ts` workbox `navigateFallbackDenylist`에 `/landing/` 추가(SW가 가로챔), `firebase.json`에 `/landing{,/**}` no-store 헤더 추가(배포해도 갱신이 안 보이던 문제)
- **Stitch 데스크톱 시안은 미채택** — "출시 대기 중", "12,400+ 커플", 앱스토어 다운로드, 이메일 사전예약 등 사실이 아닌 카피를 지어냄. 모바일 시안만 채택 후 반응형 확장

### SVIL 카피라이트 정본
- `~/.claude/skills/svil-copyright/SKILL.md` **신설 = 유일한 정본**
- 표준 문구: `© {연도} SVIL Singularity Visual Intelligence Lab.` — 연도 하드코딩 금지(렌더 시점 값), 번역 금지
- `svil-frontend-design`, `svil-landing-page`는 포인터만 남기고 기존 푸터 규칙 삭제. 랜딩 템플릿은 사본 제거 후 `{{SVIL_FOOTER}}` 자리만
- 메모리 `svil-copyright-standard.md` + MEMORY.md 등록
- Tether에 잘못 붙어 있던 MIT 라이선스 표기 제거(오픈소스 아님)
- 후원 문구는 기본 푸터에서 제외, 별도 지시가 있을 때만 추가

### Ghost 소개글
- https://ghost-production-0ec2.up.railway.app/dulman-sseuneun-keopeul-jeonyong-aebeul-mandeuleossseubnida-tether-sogae/
- 24섹션 / 이미지 12장(zimage) / 일반 대중 · 친근한 존댓말 · 랜딩 CTA
- 라이브 검증: h2 24개, 이미지 12장 로드, alt 13개 전부 한글, 인코딩 깨짐 0
- 대표이미지 1장 반려 후 재생성 — `strands reaching toward each other`가 사람 손을 만들어냄(이미지 가이드가 경고한 추상 명사 함정). "두 점을 잇는 하나의 선"으로 교체
- ComfyUI는 작업용으로 올렸다가 종료함

### 알림 재점검
- 사이드카 정상(v0.3.2, ping 응답). **원인은 알림 설정 값** — 두연 3개 전부 꺼짐, 유선 message 꺼짐. 서버는 받는 사람 설정을 보므로 양방향 차단 상태였음
- 두 계정 `notificationSettings.message`를 true로 복구. 두연의 status·diary는 의도적일 수 있어 유지

### 기록
- 완료보고서: `docs/claude-code-2026-08-03-relay-polish-landing-page-copyright.md` (Vault 동기화 완료)
- Outline 「Tether 개발진행 히스토리」(id `f608cb50-c425-4d3f-b7e3-e1ce4c5b4d93`)에 v0.14.2~v0.17.0 절 append
- 커밋 `f1df57b` (main = `claude/chat-caption-ios-kb`, push 완료)

## 진행 중 / 미완료 작업
- **알림 설정 재발 관찰** — 1차 체크포인트에서 켠 값이 이번에 또 꺼져 있었다. 소장님이 직접 끈 것인지, v0.14.0 이전 번들을 든 기기가 여전히 서버 값을 덮어쓰는지 미확인. 또 꺼지면 값만 되돌리지 말고 **어느 기기가 언제 덮어썼는지**부터 확인할 것
- 랜딩 페이지 스크린샷 5장 미확보 — `public/landing/shots/`에 `chat.png` / `relay.png` / `home.png` / `diary.png` / `listen.png`. 개인정보 주의(실제 대화·이름 노출 금지)
- Ghost 포스트 이미지 → 실제 스크린샷 교체 (위 5장 확보 후)
- 아이폰 채팅 입력(v0.11.0) 실기기 확인 — 1차 체크포인트부터 계속 미확인
- 릴레이소설 화면 조작 실기기 확인
- `package.json` 버전(0.5.12)과 `APP_VERSION`(0.17.0) 불일치 정리

## 주요 결정사항 / 규칙
- **UTF-8 파일에 PowerShell 텍스트 조작 금지.** 이번 세션에서 `Get-Content`/`Set-Content`가 CP949로 읽어 랜딩 페이지의 한중일베 텍스트를 전부 깨뜨렸고 그대로 한 번 배포됐다(복구 불가, 재작성). Node·Python 또는 편집 도구를 쓴다
- 카피라이트는 `svil-copyright` 스킬이 **유일한 정본**. 문구를 바꿀 땐 정본만 고치고 정본 §9의 반영 대상 목록을 따라간다. 다른 스킬·템플릿에 사본을 만들지 않는다
- 랜딩 페이지 폰트 하한은 **12px**(기존 SVIL 표준 16px 하한을 소장님 지시로 해제). 본문 기본은 18px 유지
- 생성형 디자인 시안(Stitch 등)의 카피는 사실 검증 없이 채택하지 않는다
- 배포 전 번들에 Firebase 설정 주입 여부 검사, 배포 후 실제 URL 접속 확인(1차 체크포인트에서 정착시킨 습관 유지)

## 참고 정보
- 라이브: https://tether-d1dab.web.app (앱 v0.17.0) · https://tether-d1dab.web.app/landing/
- Outline 히스토리: /doc/tether-9S7XLSjLsP (id `f608cb50-c425-4d3f-b7e3-e1ce4c5b4d93`)
- 완료보고서(로컬): `docs/claude-code-2026-08-03-relay-polish-landing-page-copyright.md`
- 완료보고서(Vault): `G:\내 드라이브\SVIL Vault\03_PRJ\Tether\Tether_완료보고서_20260803_릴레이다듬기_랜딩페이지_카피라이트_ClaudeCode.md`
- 리뷰용 PR: https://github.com/kuroicode-beep/tether/pull/1 (**머지 금지** — 이미 main 반영됨)
- DeepSeek 키는 `functions/.env`(gitignore). `deepseek-v4-flash`는 추론형이라 `max_tokens` 1500 유지 필수(300이면 본문이 빈 채 반환)

## 다음 세션 시작 시 할 일
1. 알림 설정이 또 꺼졌는지 확인 (`users/{uid}.notificationSettings`) — 꺼졌다면 덮어쓰는 기기 추적
2. 랜딩 스크린샷 5장 확보 → `public/landing/shots/` 배치 → 재배포
3. Ghost 포스트 이미지를 실제 스크린샷으로 교체
4. 아이폰 실기기에서 채팅 입력(v0.11.0)·릴레이소설 화면 확인
5. `package.json` 버전을 `APP_VERSION`과 맞추기
