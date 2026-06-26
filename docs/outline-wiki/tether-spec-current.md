# Tether 구현 스펙

작성일: 2026-06-26  
기준 버전: v0.5.6

## 01. 버전 관리

- 단일 표시 소스: `src/lib/appVersion.ts`
- 패키지 버전: `package.json`, `package-lock.json`
- 현재 기준: `0.5.6`
- 앱 내 표기: `APP_VERSION_LABEL`
- Log 페이지는 릴리즈/업데이트/핫픽스를 역순으로 표시한다.

## 02. 주요 라우팅

라우팅 진입: `src/App.tsx`

주요 화면:

- `home`
- `chat`
- `diary`
- `contents`
- `photo`
- `library`
- `listenTogether`
- `links`
- `dateRecipe`
- `history`
- `anniversary`
- `releaseLog`
- `admin`
- `settings`

## 03. 세션과 인증

핵심 파일:

- `src/context/SessionContext.tsx`
- `src/lib/coupleAuth.ts`
- `src/hooks/useCoupleSession.ts`

상태 모델:

- `loading`
- `signed_out`
- `no_couple`
- `approval_pending`
- `restoring`
- `connected`
- `restore_failed`

주요 원칙:

- `users/{uid}`를 세션 source of truth로 사용
- Google 로그인 기반
- coupleId는 클라이언트 임의 수정 금지
- 연결 복구 실패는 온보딩이 아니라 복원 실패 화면으로 분리

## 04. 데이터 모델

### 04-1. 커플

경로: `couples/{coupleId}`

주요 필드:

- `members: string[]`
- `selections: Record<uid, ListenTrack[]>`
- `excludedBy: Record<uid, string | null>`
- `mainThemeTrack`

### 04-2. 채팅 메시지

경로: `couples/{coupleId}/messages/{messageId}`

파일 메시지:

- `senderUid`
- `type: 'file'`
- `fileUrl`
- `fileName`
- `fileType`
- `fileSize`
- `createdAt`
- `readBy`

### 04-3. 자료실 파일 인덱스

경로: `couples/{coupleId}/files/{fileId}`

목적:

- 채팅 메시지 조회 범위에 묶이지 않는 안정적인 파일 목록
- 자료실/같이듣기 공통 소스

표시 규칙:

- 자료실: 음악 파일 제외
- 같이듣기: 음악 파일만 표시

### 04-4. Log 리포트

경로: `couples/{coupleId}/feedbackReports/{reportId}`

필드:

- `type: 'improvement' | 'bug'`
- `text`
- `status: 'open' | 'done'`
- `authorUid`
- `authorNickname`
- `createdAt`
- `updatedAt`
- `doneAt`
- `doneBy`

## 05. 주요 훅

- `useChat`: 채팅 메시지, 파일/이미지 업로드, 읽음 처리
- `useLibrary`: files 인덱스와 과거 message 파일 병합, 링크공유, 데이트 레시피
- `useListeningTogether`: 같이듣기 selections/excludedBy 동기화
- `useUnreadBadges`: 채팅/일기/콘텐츠 배지 계산
- `usePushNotification`: FCM 토큰, 권한, 알림 설정
- `useFeedbackReports`: Log 하단 기능개선/버그 리포트 동기화

## 06. 알림

구성:

- FCM token 저장
- 멀티 디바이스 토큰 지원
- Cloud Functions multicast 발송
- Service Worker background notification
- foreground toast/sound 분리

현재 정책:

- 앱 창이 보이면 내부 토스트와 소리
- 앱이 hidden/minimized 상태일 때만 시스템 알림
- iOS Safari 탭에서는 push permission 요청 차단
- iOS standalone PWA에서만 push 허용

## 07. 같이듣기 플레이어

파일:

- `src/screens/ListenTogetherScreen.tsx`
- `src/hooks/useListeningTogether.ts`
- `src/components/ThemeMusicPlayer.tsx`

동작:

- 업로드된 음악 전체 목록에서 내 3곡 선택
- 상대방 선택 곡은 수정 불가
- 상대방 곡 중 1곡 제외 가능
- 플레이리스트 갱신 버튼으로 상단 플레이어 적용
- 전체 후보 중 랜덤 시작
- 곡 종료 시 전체 후보 중 랜덤 다음 곡 선택
- 플레이어 숨김 상태에서도 음악 재생 유지

## 08. 접근성 / 고대비

기본 규칙:

- 최소 터치 타겟 50px
- 다크/고대비 모드 기본 준수
- 밝은 배경 + 흰 글씨 금지
- 고대비 박스: 검은 배경, 흰 글씨, 흰 보더
- 선택 상태는 크기 변화만으로 표현하지 않고 반전/보더/아이콘으로 표현

## 09. 검증

기본:

```bash
npm run build
```

Rules 변경:

```bash
firebase deploy --only firestore:rules --dry-run
firebase deploy --only firestore:rules
```

Hosting:

```bash
firebase deploy --only hosting
```

