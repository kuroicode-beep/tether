# Tether 안정화 실제 작업지시문

작성일: 2026-06-09  
기준 문서: `docs/engineering-review-2026-06-09.md`  
목표: 데이터 동기화, 인증/세션, 읽음/뱃지, 알림/PWA, UI 접근성 불안정 문제를 단계적으로 안정화한다.

## 00. 공통 작업 원칙

모든 단계에 공통 적용한다.

1. 기존 사용자 데이터는 삭제하지 않는다.
2. `users/{uid}.coupleId`를 클라이언트에서 임의로 null 처리하지 않는다.
3. `localStorage`는 캐시로만 사용하고, 연결 상태의 source of truth로 쓰지 않는다.
4. Firestore rules 변경과 클라이언트 로직 변경이 맞물리는 작업은 같은 PR에서 검증한다.
5. 각 단계 완료 후 `npm run build`를 통과시킨다.
6. Firestore rules를 수정한 단계는 Firebase rules 테스트 또는 실 프로젝트에서 최소 수동 검증을 수행한다.
7. Android/iOS PWA 관련 단계는 배포 후 실기기 테스트 없이는 완료로 보지 않는다.

## 01. 전체 작업 순서

권장 순서는 아래와 같다.

| Step | 작업명 | 목적 | 우선순위 |
|---|---|---|---|
| 1 | Session Source of Truth 통합 | 로그인/복원/라우팅 안정화 | Critical |
| 2 | Read/Badge 모델 정리 | 뱃지와 읽음 상태 일관화 | Critical |
| 3 | Firestore rules 및 ownership 강화 | 서버 데이터 무결성 확보 | Critical |
| 4 | Optimistic sync 정리 | 실패/중복/순서 꼬임 감소 | High |
| 5 | PWA/알림/UI 접근성 안정화 | 실기기 UX 안정화 | High |
| 6 | 회귀 테스트 및 Codex 재검증 | 배포 가능성 판단 | Required |

---

# Step 1. Session Source of Truth 통합

## 1-1. 목표

현재 분산된 연결 상태를 하나의 세션 모델로 통합한다.

현재 문제:

- `useAuth`가 `coupleId`, `connection`을 관리한다.
- `useCoupleSession`이 다시 `users/{uid}`를 구독한다.
- `AppContext`가 `localStorage` 기반 uid/coupleId/partnerUid를 유지한다.
- 라우팅은 `coupleId` 기준이고, 데이터 훅은 다른 coupleId를 볼 수 있다.

목표 상태:

```ts
type SessionStatus =
  | 'loading'
  | 'signed_out'
  | 'no_couple'
  | 'restoring'
  | 'connected'
  | 'restore_failed'
```

화면은 `coupleId` 문자열이 아니라 `status === 'connected' && connection != null` 기준으로 진입한다.

## 1-2. 영향 파일

- `src/hooks/useAuth.tsx`
- `src/hooks/useCoupleSession.ts`
- `src/context/AppContext.tsx`
- `src/App.tsx`
- `src/lib/coupleAuth.ts`
- `src/screens/OnboardingScreen.tsx`
- `src/screens/SettingsScreen.tsx`

## 1-3. 구현 지시

### 1. 세션 타입 정의

새 파일을 만든다.

권장 파일:

- `src/context/SessionContext.tsx`

포함 상태:

```ts
type SessionStatus =
  | 'loading'
  | 'signed_out'
  | 'no_couple'
  | 'restoring'
  | 'connected'
  | 'restore_failed'

type SessionState = {
  status: SessionStatus
  user: User | null
  uid: string | null
  coupleId: string | null
  connection: RestoredConnection | null
  error: string | null
}
```

### 2. `users/{uid}` snapshot은 한 곳에서만 구독

`useAuth`, `useCoupleSession`, `UnreadBadgesContext`가 각각 `users/{uid}`를 구독하는 구조를 줄인다.

1차 목표:

- session provider가 `users/{uid}`를 구독한다.
- `coupleId`, `lastRead`, `notificationSettings`는 session/profile state에서 내려준다.

완전 통합이 부담되면 최소한:

- `useCoupleSession` 제거 또는 thin wrapper화
- `useAuth`의 `coupleId`와 `connection`만 라우팅 기준으로 사용
- `AppContext`는 connection cache만 담당

### 3. restore generation 적용

`restoreConnectionFromProfile(uid)` 호출 시 ref counter를 사용한다.

의도:

- 오래 걸린 이전 restore 결과가 최신 세션을 덮지 못하게 한다.

예시:

```ts
const restoreGenerationRef = useRef(0)

const restore = async (uid: string) => {
  const generation = ++restoreGenerationRef.current
  const restored = await restoreConnectionFromProfile(uid)
  if (generation !== restoreGenerationRef.current) return
  // 최신 요청만 반영
}
```

### 4. restore 실패 상태 분리

현재처럼 복원 실패를 `coupleId = null`로 처리하지 않는다.

분기:

- `users/{uid}.coupleId` 없음 → `no_couple`
- `coupleId` 있음 + restore 성공 → `connected`
- `coupleId` 있음 + restore 실패 → `restore_failed`

`restore_failed` 화면에는 아래 액션을 둔다.

- 다시 시도
- 로그아웃
- 고객/개발자 확인용 에러 정보 표시

### 5. App 라우팅 변경

`src/App.tsx`에서 아래 기준으로 화면을 나눈다.

```ts
if (session.status === 'loading' || session.status === 'restoring') {
  return <LoadingScreen />
}

if (session.status === 'signed_out' || session.status === 'no_couple') {
  return <OnboardingScreen />
}

if (session.status === 'restore_failed') {
  return <RestoreFailedScreen />
}

if (session.status === 'connected') {
  return <LockOrHome />
}
```

## 1-4. 완료 조건

- `useAuth`, `useCoupleSession`, `AppContext`가 서로 다른 coupleId를 보여주지 않는다.
- `connection === null`인데 홈/잠금 화면에 진입하지 않는다.
- Android에서 기존 Google 계정 로그인 시 PC와 같은 couple data가 복원된다.
- 복원 실패 시 onboarding이 아니라 복원 실패/재시도 화면이 나온다.

## 1-5. 테스트

- PC에서 가입한 Google 계정으로 Android Chrome 로그인
- 익명 계정으로 시작 후 Google 연결
- 새로고침 후 same couple 복원
- Firestore에서 임시로 `users/{uid}.coupleId`를 잘못된 값으로 바꿨을 때 `restore_failed`
- 다른 계정으로 로그아웃/로그인 전환

---

# Step 2. Read/Badge 모델 정리

## 2-1. 목표

읽었는데 뱃지가 사라지지 않거나, 보지 않았는데 뱃지가 사라지는 문제를 제거한다.

## 2-2. 영향 파일

- `src/context/UnreadBadgesContext.tsx`
- `src/components/BottomNav.tsx`
- `src/screens/ChatScreen.tsx`
- `src/screens/DiaryScreen.tsx`
- `src/screens/ContentsScreen.tsx`
- `src/hooks/useChat.ts`
- `src/hooks/useDiary.ts`
- `firestore.rules`

## 2-3. 모델 결정

권장 기준:

| 기능 | 읽음 기준 | 이유 |
|---|---|---|
| Chat | `readBy` | 메시지 단위 읽음 표시와 일치 |
| Diary | `isRead` | 현재 UI와 일치 |
| Contents | `lastRead.contents` | 항목 단위 읽음이 아직 없음 |

`lastRead.more`는 제거하거나 `lastRead.contents`로 이름을 바꾼다.

## 2-4. 구현 지시

### 1. `NavTab` 정리

현재:

```ts
type NavTab = 'chat' | 'diary' | 'more'
```

권장:

```ts
type NavTab = 'chat' | 'diary' | 'contents'
```

단, BottomNav에 Contents 탭이 없다면 다음 중 하나를 결정한다.

Option A:

- BottomNav의 `more` badge를 없앤다.
- ContentsScreen 진입 지점에 별도 badge를 표시한다.

Option B:

- BottomNav `more` badge는 유지하되 `Settings` 진입 시 markRead하지 않는다.
- 실제 ContentsScreen 진입 시에만 `markTabRead('contents')`를 호출한다.

권장: Option B.

### 2. Chat badge 기준 통일

`UnreadBadgesContext`의 chat count는 `readBy` 기준으로 계산한다.

```ts
counts.chat = docs.filter((d) => {
  const data = d.data()
  return data.senderUid !== uid && !(data.readBy ?? []).includes(uid)
}).length
```

그 후 `lastRead.chat`는 제거하거나 보조 용도로만 남긴다.

### 3. Diary badge 기준 통일

Diary는 이미 `isRead`가 있으므로 이를 유지한다.

```ts
counts.diary = docs.filter((d) => {
  const data = d.data()
  return data.authorUid !== uid && data.isRead !== true
}).length
```

`markTabRead('diary')`는 badge에 영향을 주지 않으므로 제거하거나 이름을 분리한다.

### 4. Contents badge 수정

`lastRead.more` 대신 `lastRead.contents`를 사용한다.

Settings 진입 시 아래 호출을 하지 않는다.

```ts
markTabRead('more')
```

ContentsScreen이 mount될 때만:

```ts
markTabRead('contents')
```

### 5. Chat `markAsRead` 중복 방지

`ChatScreen`에 pending set을 둔다.

```ts
const markingReadRef = useRef<Set<string>>(new Set())
```

메시지 읽음 처리 시:

- 이미 `readBy`에 uid가 있으면 skip
- `markingReadRef`에 있으면 skip
- 성공/실패 후 set에서 제거

가능하면 `writeBatch`로 묶는다.

## 2-5. Firestore rules 요구

파트너가 아래 필드만 갱신할 수 있어야 한다.

- `messages/{messageId}.readBy`
- `diary/{diaryId}.isRead`

단, sender/author가 아닌 사용자가 다른 필드를 바꾸면 거부되어야 한다.

## 2-6. 완료 조건

- 채팅방에 들어가면 상대 메시지 badge가 사라진다.
- 일기는 카드 실제 열람 시에만 badge가 사라진다.
- Settings에 들어가도 Contents badge가 사라지지 않는다.
- 같은 계정의 다른 기기에서도 읽음 상태가 반영된다.

---

# Step 3. Firestore rules 및 ownership 강화

## 3-1. 목표

UI에서 막는 권한을 서버 rules에서도 보장한다.

## 3-2. 영향 파일

- `firestore.rules`
- `storage.rules`
- `scripts/test-e2e-firebase.ts`
- 필요 시 rules unit test 파일 신규 작성

## 3-3. 구현 지시

### 1. `users/{uid}` read 제한

현재 모든 인증 사용자가 read 가능하다면 다음 구조로 좁힌다.

허용:

- 본인
- 같은 couple의 partner

검토:

- Cloud Functions는 Admin SDK이므로 rules 영향 없음
- 클라이언트에서 타인의 전체 user doc을 읽어야 하는지 확인

민감 필드:

- `fcmToken`
- `notificationSettings`
- `lastRead`

가능하면 private/public 분리:

- `users/{uid}`: private
- `publicProfiles/{uid}`: nickname, avatar 등 공개 정보

### 2. `coupleId` 클라이언트 수정 금지

`users/{uid}` update에서 `coupleId` 변경을 금지한다.

허용 필드 예시:

- `nickname`
- `inviteCode`
- `fcmToken`
- `fcmUpdatedAt`
- `notificationSettings`
- `lastRead`

`coupleId`는 `claimInvite`, `disconnectCouple` 같은 Cloud Function만 수정한다.

### 3. messages update 제한

허용:

- 작성자: `text`, `editedAt` 수정
- 수신자: `readBy`만 수정
- 작성자: delete 가능

거부:

- `senderUid` 변경
- `createdAt` 변경
- `imageUrl` 변경
- `type` 변경

### 4. contents/photos/history ownership 통일

각 문서에 owner field를 명확히 둔다.

권장:

| Collection | Owner field |
|---|---|
| contents | `addedBy` |
| photos | `uploadedBy` |
| history | `authorUid` |

규칙:

- create: owner field가 `request.auth.uid`와 같아야 함
- update/delete: 기존 owner field가 `request.auth.uid`와 같아야 함

파트너가 상태만 변경 가능한 예외가 필요하면 필드를 좁혀 별도 허용한다.

### 5. Storage rules 점검

사진/채팅 이미지 경로가 couple member만 접근 가능하도록 유지한다.

확인할 경로:

- `couples/{coupleId}/images/...`
- `couples/{coupleId}/photos/...`

## 3-4. 테스트

필수 테스트:

- 본인이 아닌 사용자의 `users/{uid}.coupleId` update 거부
- 본인이 본인 `lastRead.chat` update 허용
- 파트너가 message `readBy` update 허용
- 파트너가 message `text` update 거부
- 파트너가 content delete 거부
- 본인 content delete 허용

---

# Step 4. Optimistic sync와 clientId reconciliation

## 4-1. 목표

전송 직후 중복 표시, 실패 후 UI 불일치, 같은 내용 병합 오류를 줄인다.

## 4-2. 영향 파일

- `src/lib/syncHelpers.ts`
- `src/hooks/useChat.ts`
- `src/hooks/useDiary.ts`
- `src/hooks/useContents.ts`
- `src/hooks/usePhotos.ts`
- `src/hooks/useHistory.ts`

## 4-3. 구현 지시

### 1. clientId 생성 유틸 추가

권장 파일:

- `src/lib/clientId.ts`

예시:

```ts
export function createClientId(prefix: string) {
  return `${prefix}_${Date.now()}_${crypto.randomUUID()}`
}
```

### 2. 모든 create write에 `clientId` 추가

적용 대상:

- chat message
- diary entry
- diary reply
- content item
- photo item
- history item

### 3. optimistic item에도 같은 `clientId` 저장

현재 `opt_${Date.now()}`만 쓰는 경우를 `clientId` 기반으로 바꾼다.

### 4. `syncHelpers.reconcilePending` 수정

우선순위:

1. `clientId` exact match
2. 기존 fallback: author + title/text + time window

fallback은 기존 데이터 호환을 위해 유지하되, 새 데이터는 clientId로 매칭한다.

### 5. 실패 rollback 표준화

공통 패턴:

```ts
applyOptimistic()
try {
  await write()
} catch (error) {
  rollback()
  showError()
}
```

적용 대상:

- diary read
- diary reply
- content status
- anniversary update
- photo caption

## 4-4. 완료 조건

- 같은 메시지를 연속으로 보내도 bubble이 사라지거나 합쳐지지 않는다.
- 이미지 여러 장을 빠르게 보내도 순서와 매칭이 유지된다.
- Firestore write 실패 시 UI가 성공 상태로 남지 않는다.
- snapshot 도착 후 optimistic item과 server item이 중복되지 않는다.

---

# Step 5. PWA/알림/UI 접근성 안정화

## 5-1. 목표

Android/iOS PWA, 알림, 고대비, 줄바꿈, safe-area 문제를 안정화한다.

## 5-2. 영향 파일

- `src/App.tsx`
- `src/hooks/usePushNotification.ts`
- `src/lib/notificationAlert.ts`
- `public/firebase-messaging-sw.js`
- `functions/src/index.ts`
- `vite.config.ts`
- `firebase.json`
- `src/styles/tokens.css`
- `src/components/ToastNotification.tsx`
- `src/components/BottomNav.tsx`
- `src/components/ChatInput.tsx`
- `src/screens/ChatScreen.tsx`
- `src/screens/HomeScreen.tsx`
- `src/hooks/useFontScale.ts`

## 5-3. 구현 지시

### 1. Notification click deep link 연결

문제:

- SW가 `/?screen=chat`으로 이동시켜도 React는 내부 state를 사용한다.
- 이미 앱이 열린 상태에서는 화면 전환이 누락될 수 있다.

작업:

- SW에서 `client.postMessage({ type: 'NAVIGATE', screen })` 전송
- `App.tsx`에서 `navigator.serviceWorker.addEventListener('message')` 처리
- 잠금 상태면 pending target 저장 후 unlock 후 이동

### 2. Foreground 알림 중복 제거

현재 foreground에서 소리, 시스템 알림, toast가 동시에 발생할 수 있다.

권장:

| 상태 | 동작 |
|---|---|
| 앱 visible | toast + 선택적 sound |
| 앱 hidden | system notification |
| SW background | showNotification |

### 3. iOS push permission gate

조건:

- iOS Safari + not standalone → permission 요청 금지
- 설치 안내 먼저 표시
- standalone PWA에서만 permission 요청

이미 export된 helper:

- `isIOSBrowser()`
- `isStandalonePwa()`

이를 실제 permission flow에 연결한다.

### 4. Font scale bootstrap

`useFontScale()`이 Settings에서만 실행되면 reload 후 반영되지 않는다.

작업:

- `App.tsx` 최상단에서 font scale bootstrap 실행
- 또는 `useFontScaleBootstrap` 별도 hook 작성

### 5. Safe-area 보강

확인 대상:

- Chat header
- Home sticky header
- BottomNav
- ChatInput
- ImageViewer close button

필요 CSS:

```css
padding-top: calc(12px + env(safe-area-inset-top, 0px));
padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
```

### 6. 고대비/줄바꿈 정리

작업:

- hardcoded Tailwind hex 색상을 가능한 CSS var로 전환
- 고대비 override를 주요 화면 전체에 적용
- 채팅 bubble은 한국어 `word-break: keep-all`, URL은 `overflow-wrap: anywhere` 보조 처리
- 내/상대 말풍선의 width 계산 중복 제거

### 7. 터치 타겟 50px 기준

점검 대상:

- BottomNav button
- Chat image button
- Chat send button
- PIN keypad
- Settings switches

최소 기준:

```css
min-width: 50px;
min-height: 50px;
```

## 5-4. 완료 조건

- Android PWA에서 background push가 온다.
- 앱이 열린 상태에서는 중복 알림이 뜨지 않는다.
- iOS Safari에서는 설치 전 push 허용을 요청하지 않는다.
- 고대비에서 모든 주요 텍스트가 명확히 보인다.
- 긴 한국어 문장, URL, 이모지가 자연스럽게 줄바꿈된다.
- 하단 nav와 chat input이 safe-area에 가리지 않는다.

---

# Step 6. 최종 검증 및 배포 판정

## 6-1. 자동 검증

실행:

```bash
npm run build
```

functions 변경 시:

```bash
cd functions
npm run build
```

권장 추가:

```bash
npx tsx scripts/test-e2e-firebase.ts
```

rules 테스트가 추가되면 emulator 기반 테스트도 실행한다.

## 6-2. 실기기 검증

### Android Chrome/PWA

- [ ] PC 가입 Google 계정으로 로그인
- [ ] 같은 couple data 복원
- [ ] PWA 설치 후 알림 권한 허용
- [ ] PC에서 메시지 전송 시 Android background 알림 수신
- [ ] 앱 visible 상태에서 중복 알림 없음
- [ ] 긴 메시지 줄바꿈 자연스러움
- [ ] 고대비 내 메시지 가독성 확인

### iOS Safari/PWA

- [ ] Safari tab에서 설치 안내 표시
- [ ] Home Screen PWA에서 알림 권한 요청
- [ ] safe-area header/input 확인
- [ ] keyboard가 chat input을 가리지 않음

### PC Chrome

- [ ] 720px layout 유지
- [ ] Android와 데이터 동기화
- [ ] 채팅/일기/콘텐츠 badge 동작 확인

## 6-3. Codex 재검증 요청 항목

Codex에게 아래 기준으로 재검증을 요청한다.

1. 세션 상태 머신이 명확한지
2. 복원 실패와 no couple이 분리되는지
3. Firestore rules가 데이터 무결성을 보장하는지
4. 읽음/뱃지 기준이 기능별로 하나인지
5. optimistic sync가 실패 시 rollback되는지
6. PWA 알림이 Android/iOS 조건별로 분기되는지
7. 고대비/접근성 기준이 주요 화면에 적용되는지

---

# 07. 작업 단위별 커밋 권장 메시지

## Step 1

```text
Unify session source of truth and restore state handling.
```

## Step 2

```text
Normalize unread badge semantics across chat diary and contents.
```

## Step 3

```text
Tighten Firestore rules for user profile and content ownership.
```

## Step 4

```text
Add clientId-based optimistic reconciliation and rollback handling.
```

## Step 5

```text
Stabilize PWA notifications, safe areas, and high contrast chat UI.
```

---

# 08. 완료 보고서 작성 기준

각 Step 완료 시 Notion 또는 로컬 완료 보고서에 아래 항목을 기록한다.

```text
제목: 완료 보고서 — Tether 안정화 Step N ([작업명], Cursor, YYYY.MM.DD)

## 01. 작업 요약
- 목표:
- 결과:
- 배포 여부:

## 02. 변경 파일
| 파일 | 변경 내용 | 비고 |

## 03. 구현 결과
- 완료:
- 미완료:

## 04. 검증
- 빌드:
- rules 테스트:
- 실기기 QA:

## 05. 남은 리스크
- 

## 06. Codex 재검증 요청 포인트
- 

## 07. Git
- 커밋:
- push:
```

---

# 09. 우선 착수 지시문

가장 먼저 Cursor가 수행할 작업은 아래 하나로 제한한다.

```text
Tether 안정화 Step 1 — Session Source of Truth 통합

목표:
- 인증, couple 복원, AppContext, 화면 라우팅의 기준을 단일 session 상태로 통합한다.
- connection 없는 coupleId로 홈/잠금 화면에 진입하지 않게 한다.
- restore 실패를 no_couple과 분리한다.

금지:
- 기존 사용자 데이터 삭제 금지
- users/{uid}.coupleId를 클라이언트에서 임의로 null 처리 금지
- Firestore schema 대규모 변경 금지

완료 조건:
- PC 가입 Google 계정으로 Android 로그인 시 같은 couple data 복원
- 복원 실패 시 onboarding 대신 restore_failed UI 또는 재시도 상태 표시
- npm run build 통과
```
