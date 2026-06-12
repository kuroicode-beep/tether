# Tether v0.2.0 상세 스펙

작성일: 2026-06-12  
버전: `0.2.0` (`src/lib/appVersion.ts`)  
배포: Firebase Hosting (`tether-d1dab`)  
대상: 커플 2인 PWA (Web / iOS 홈 화면 / Android PWA)

---

## 01. 릴리즈 개요

Tether v0.2.0은 v0.1 안정화 이후 **접근성(고대비)**, **설정 UX**, **Log 가독성**, **PWA 브랜딩**, **계정 복구·알림 안정화**를 묶은 기능 릴리즈다.

| 구분 | v0.1.0 | v0.2.0 |
|---|---|---|
| 고대비 기본 패턴 | 부분 적용, 화면별 불일치 | 검은 배경 + 흰 글씨 + 둥근 흰 보더 전면 표준화 |
| 설정 폰트 선택 | Sage 테마 중심, HC 선택 표시 불명확 | 체크 아이콘 + HC 전용 선택 테두리 |
| Log 페이지 | 전체 목록 한 페이지 | 8건 단위 페이징 |
| PWA 아이콘 | 생성형/깨진 한글 부제 | 제공 브랜딩 PNG 기반 + maskable 분리 |
| 버전 표기 | `0.1.0` 분산 | `appVersion.ts` 단일 소스 |

---

## 02. 버전 및 표시 규칙

### 2-1. 단일 소스

```ts
// src/lib/appVersion.ts
export const APP_VERSION = '0.2.0'
export const APP_VERSION_LABEL = `v${APP_VERSION}`
```

### 2-2. 표시 위치

| 위치 | 파일 |
|---|---|
| 홈 헤더 | `src/screens/HomeScreen.tsx` |
| 설정 > App info | `src/screens/SettingsScreen.tsx` |
| Log 소개 문구 | `src/screens/ReleaseLogScreen.tsx` |
| npm package | `package.json` |

앞으로 버전 올릴 때 `appVersion.ts`와 `package.json`을 함께 수정한다.

---

## 03. 테마 · 접근성

### 3-1. Sage (기본)

- 배경: `#EEE9DC`
- Primary: `#4A7B5F`
- 본문 최소 16px, 터치 타겟 50px 이상

### 3-2. High Contrast (고대비)

**기본 가독성 박스 패턴 (v0.2.0 표준)**

| 토큰 | 값 |
|---|---|
| `--hc-box-bg` | `#000000` |
| `--hc-box-text` | `#FFFFFF` |
| `--hc-box-border` | `#FFFFFF` |
| `--hc-box-radius` | `16px` |
| `--hc-box-border-width` | `2px` |

**적용 대상**

- 채팅 / 히스토리 / 상태 기록 메시지 박스
- 상태 태그 (`MoodChip`) — 홈 메인·편집
- Primary / outline / FAB / PIN / 전송 버튼
- 입력창 (채팅, 폼)
- 콘텐츠 카드, 토스트, 필터 칩
- Log 페이징 버튼

**유틸리티 클래스**

- `.hc-readable-box` — 기본 박스
- `.hc-readable-box--pill` — pill 형태
- `.hc-readable-box--circle` — 원형

**강조색**

- 라벨·헤더·아이콘: `#FFE600` (primary text)
- interactive fill 전체를 노란색으로 채우지 않음 (가독성 박스 우선)

---

## 04. 설정 (Appearance)

### 4-1. 폰트 크기

| 값 | 배율 | 라벨 |
|---|---|---|
| S | 0.92 | 소 |
| M | 1.0 | 중 (기본) |
| L | 1.14 | 대 |

- 저장: `localStorage.tether_font_scale`
- 적용: `--font-scale` CSS 변수

### 4-2. 폰트 선택

| ID | 표시명 |
|---|---|
| default | 기본 |
| cafe24-dongdong | 카페24동동체 |
| maplestory | 메이플스토리체 |
| nanum-gothic | 나눔고딕 |
| line-seed | 라인시드체 |
| gowun-dodum | 고운돋움체 |
| nanum-square-round | 나눔스퀘어라운드R |
| tmoney-round | 티머니둥근바람체 |
| recipe-korea | 레코체 |
| kyobo-handwriting-2019 | 교보손글씨2019 |

- 저장: `localStorage.tether_font_family`
- 적용: `--app-font-family`

### 4-3. v0.2.0 선택 표시 (고대비 포함)

- 선택된 폰트: `settings-font-option--active` + `check_circle` 아이콘
- 고대비: 흰 3px 보더 + 노란 외곽 링 (`box-shadow`)
- 폰트 크기: `settings-font-scale-option--active`에 HC 박스 스타일

---

## 05. Log 페이지

### 5-1. 데이터

- `RELEASE_LOGS` 배열 (`src/screens/ReleaseLogScreen.tsx`)
- 타입: `release` | `update` | `hotfix`
- **모든 사용자-facing 변경은 Log에 항목 추가** (프로젝트 정책)

### 5-2. 페이징 (v0.2.0)

| 항목 | 값 |
|---|---|
| 페이지 크기 | 8건 |
| 정렬 | 최신순 (배열 상단이 최신) |
| UI | 이전 / 다음, `n-m / total`, `page / totalPages` |
| 접근성 | `<nav aria-label="업데이트 기록 페이지">` |

---

## 06. PWA · 아이콘

| 파일 | 용도 |
|---|---|
| `public/icon-192.png` | manifest any 192 |
| `public/icon-512.png` | manifest any 512 |
| `public/icon-maskable-192.png` | Android maskable |
| `public/icon-maskable-512.png` | Android maskable |
| `public/apple-touch-icon.png` | iOS 180 |
| `public/icon.svg` | favicon SVG (512 PNG base64) |
| `assets/brand-logo-source.png` | 생성 원본 |

재생성: `python scripts/generate-app-icons.py`

---

## 07. 알림 · 계정 (v0.2.0 포함 안정화)

### 7-1. 멀티 디바이스 FCM

- `users.fcmTokens.{deviceId}` map 저장
- Cloud Functions multicast 발송 + invalid token 정리

### 7-2. 재연결 후 알림

- 커플 재연결 성공 시 FCM 토큰 재동기화

### 7-3. Google 복구

- iOS 재설치 후 Google 로그인 → 복구 안내 화면
- 기존 연결 재확인 / 다른 계정 / 새 연결 분리
- 연결 해제: `disconnectCouple` Cloud Function

---

## 08. 화면 목록 (프론트엔드)

| 화면 | 경로/진입 | 고대비 v0.2.0 |
|---|---|---|
| Lock | PIN 잠금 | PIN 키 HC 박스 |
| Onboarding | 닉네임/초대/Google | 버튼·입력 HC |
| Home | 상태·최근활동 | 태그·메시지·버튼 HC |
| Chat | 1:1 채팅 | 말풍·입력 HC |
| Diary | 교환일기 | 카드·버튼 HC |
| Contents | 콘텐츠 | 카드·칩 HC |
| Photo | 사진첩 | 카드 HC |
| History | 우리의 기록 | 카드 HC |
| Status History | 상태 타임라인 | 메시지·태그 HC |
| Anniversary | 기념일 | 버튼 HC |
| Settings | 설정 | **폰트 선택 HC v0.2.0** |
| Release Log | Log | **페이징 v0.2.0** |
| Restore Failed | 복구 실패 | 버튼 HC |

---

## 09. 검증 체크리스트

### 빌드

```bash
npm run build
```

### 수동 QA (고대비)

- [ ] 설정 > 폰트 선택: 선택 항목에 체크·두꺼운 흰 보더 보임
- [ ] 설정 > 폰트 크기: 선택 탭(소/중/대) 구분됨
- [ ] Log: 8건씩, 이전/다음 동작
- [ ] 홈/채팅/히스토리: 메시지·태그·버튼 HC 박스 일관

### 배포

```bash
firebase deploy --only hosting
```

---

## 10. 관련 문서

| 문서 | 내용 |
|---|---|
| `docs/cursor-completion-2026-06-12-high-contrast-readable-box.md` | HC 박스 전면 적용 |
| `docs/cursor-completion-2026-06-12-app-icon-branding-v2.md` | PWA 아이콘 |
| `docs/cursor-completion-2026-06-12-v0-2-0-release.md` | v0.2.0 릴리즈 완료 |
| `docs/implementation-work-instructions-2026-06-09.md` | v0.1 안정화 작업지시 |

---

*SVIL — Tether v0.2.0 Spec | Updated: 2026.06.12*
