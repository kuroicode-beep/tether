# Tether v0.4.3 구현 스펙

작성일: 2026-06-25  
버전: v0.4.3

## 01. 앱 버전
- 단일 버전 소스: `src/lib/appVersion.ts`
- 현재 값: `APP_VERSION = '0.4.3'`
- 패키지 버전: `package.json`, `package-lock.json`
- UI 표시: `APP_VERSION_LABEL`

## 02. 라우팅
라우터 파일: `src/App.tsx`

지원 화면:
- `home`
- `chat`
- `diary`
- `contents`
- `photo`
- `library`
- `links`
- `dateRecipe`
- `history`
- `anniversary`
- `releaseLog`
- `admin`
- `settings`

독립 메뉴:
- 자료실: `library`
- 링크공유: `links`
- 데이트 레시피: `dateRecipe`

## 03. 데이터 모델
### 03-1. 채팅 메시지
경로: `couples/{coupleId}/messages/{messageId}`

파일 메시지 필드:
- `senderUid: string`
- `type: 'file'`
- `fileUrl: string`
- `fileName: string`
- `fileType: string`
- `fileSize: number`
- `createdAt: timestamp`
- `readBy: string[]`

### 03-2. 링크공유
경로: `couples/{coupleId}/links/{linkId}`

필드:
- `title: string`
- `url: string`
- `summary: string | null`
- `fileUrl: string | null`
- `fileName: string | null`
- `createdBy: string`
- `createdAt: timestamp`

Storage:
- `couples/{coupleId}/links/{uploaderUid}/{filename}`

### 03-3. 데이트 레시피
경로: `couples/{coupleId}/dateRecipes/{recipeId}`

필드:
- `date: string`
- `food: string`
- `memo: string | null`
- `createdBy: string`
- `createdAt: timestamp`

### 03-4. 콘텐츠
경로: `couples/{coupleId}/contents/{contentId}`

추가 필드:
- `url: string | null`
- `imageUrl: string | null`
- `imagePath: string | null`

Storage:
- `couples/{coupleId}/contents/{uploaderUid}/{filename}`

### 03-5. 사진첩
경로: `couples/{coupleId}/photos/{photoId}`

필드:
- `imageUrl: string`
- `caption: string | null`
- `uploadedBy: string`
- `createdAt: timestamp`

목록 카드에서 `caption`을 2줄까지 표시한다.

## 04. 주요 훅
### `useLibrary`
파일: `src/hooks/useLibrary.ts`

역할:
- 채팅 파일 메시지를 자료실 파일 목록으로 변환
- 링크공유 목록 구독 및 추가
- 데이트 레시피 목록 구독 및 추가

반환:
- `files`
- `links`
- `recipes`
- `addLink`
- `addRecipe`

### `useContents`
파일: `src/hooks/useContents.ts`

역할:
- 콘텐츠 URL/이미지 필드 읽기
- 콘텐츠 이미지 Storage 업로드
- optimistic create/update

## 05. 화면 스펙
### 05-1. 자료실
파일: `src/screens/LibraryScreen.tsx`

컴포넌트:
- `LibraryScreen`

동작:
- 채팅 파일/음악 파일만 표시
- 오디오 파일은 `<audio controls>`로 재생
- 일반 파일은 새 탭 열기/다운로드

### 05-2. 링크공유
파일: `src/screens/LibraryScreen.tsx`

컴포넌트:
- `LinkShareScreen`
- `LinkSheet`

동작:
- 사이트명, URL, 요약 설명 입력
- 바로가기 파일 선택 업로드
- 저장 후 목록에 표시

### 05-3. 데이트 레시피
파일: `src/screens/LibraryScreen.tsx`

컴포넌트:
- `DateRecipeScreen`
- `RecipeSheet`

동작:
- 날짜, 음식명, 메모 입력
- 날짜 기준 최신순 표시

### 05-4. 설정
파일: `src/screens/SettingsScreen.tsx`

동작:
- 내 닉네임 수정 가능
- 상대 닉네임은 읽기 전용
- 알림음 선택 가능

알림음 옵션:
- `waterDrop`: 물방울
- `chime`: 차임
- `sparkle`: 반짝
- `softBell`: 포근벨
- `gentleKnock`: 톡톡
- `silent`: 무음

## 06. 알림음
타입 정의: `src/hooks/usePushNotification.ts`

재생 매핑: `src/lib/notificationAlert.ts`

파일:
- `public/sounds/water-drop-20260621.wav`
- `public/sounds/chime.wav`
- `public/sounds/sparkle-20260625.wav`
- `public/sounds/soft-bell-20260625.wav`
- `public/sounds/gentle-knock-20260625.wav`

PWA precache:
- `vite.config.ts` `includeAssets`
- `workbox.globPatterns`의 `wav`

## 07. 보안 규칙
Firestore:
- `links`: 커플 멤버 read, 작성자 create/update/delete
- `dateRecipes`: 커플 멤버 read, 작성자 create/update/delete
- `contents`: 기존 owner/partner status update 정책 유지

Storage:
- `contents/{uploaderUid}` write: uploader only
- `links/{uploaderUid}` write: uploader only

## 08. 접근성 / 고대비
상태 태그:
- display variant: 메인 상태 표시용
- edit variant: 편집창 선택용

고대비 display 태그:
- 배경: `#000000`
- 글씨: `#ffffff`
- 라인: `#ffffff`

고대비 edit 선택 태그:
- 흰 배경/검은 글씨/노란 외곽 강조

## 09. 검증
필수:
- `npm run build`
- `firebase deploy --only hosting`

Rules 변경 시:
- `firebase deploy --only firestore:rules,storage`

현재 v0.4.3 변경은 알림음/문서/UI 설정 변경이므로 Hosting 배포만 필요하다.
