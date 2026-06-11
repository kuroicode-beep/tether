# ✅ 완료 보고서 — 앱 아이콘 물음표 수정 및 잎사귀 브랜딩 적용 (Cursor, 2026.06.12)

원본 작업지시문: 사용자 요청 — 홈 화면 아이콘 `???? ??` 깨짐 수정, 잎사귀 브랜딩 로고로 교체  
기준 커밋: (작업 후 기록)  
작업 브랜치: `main`

## 01. 작업 요약

- 목표: PWA/iOS/Android 앱 아이콘의 한글 깨짐(물음표) 제거 및 사용자 제공 잎사귀 브랜딩 적용
- 결과: 완료
- 소요 시간: 단기 아이콘 자산 재생성

## 02. 작업 로그

- `public/icon.svg`에 하드코딩된 `???? ??` 원인 확인 (한글 폰트 미지원 생성)
- 사용자 제공 브랜딩 이미지를 `assets/brand-logo-source.png`로 저장
- `scripts/generate-app-icons.py`로 192/512/180px PNG 및 favicon.ico 재생성
- `icon.svg`를 크림 배경 + 잎사귀 + Tether + 우리만의 공간 UTF-8 SVG로 교체
- Log 페이지에 핫픽스 내역 추가

## 03. 변경된 파일

| 파일 경로 | 변경 내용 | 비고 |
|----------|----------|------|
| `assets/brand-logo-source.png` | 사용자 제공 브랜딩 원본 | 신규 |
| `scripts/generate-app-icons.py` | PNG/favicon 생성 스크립트 | 신규 |
| `public/icon-192.png` | PWA 192px 아이콘 | 재생성 |
| `public/icon-512.png` | PWA 512px 아이콘 | 재생성 |
| `public/apple-touch-icon.png` | iOS 180px 아이콘 | 재생성 |
| `public/favicon.ico` | 브라우저 favicon | 재생성 |
| `public/icon.svg` | SVG 아이콘 (UTF-8 한글) | 교체 |
| `src/screens/ReleaseLogScreen.tsx` | Log 페이지 내역 추가 | |

## 04. 구현 결과

### ✅ 완료 항목

- 아이콘 내 `???? ??` 물음표 깨짐 제거
- 크림 배경 잎사귀 Tether 브랜딩으로 PNG/SVG/favicon 교체
- Log 페이지 업데이트

### ⚠️ 미완료 항목

- 실기기 홈 화면 아이콘 갱신 QA (PWA 재설치 필요)

## 05. 검증 결과

- `npm run build`: 통과
- 실기기 QA: 미실행

## 06. 특이점 / 결정사항

- 이전 아이콘은 Pillow/SVG 생성 시 한글 폰트가 없어 부제목이 `???? ??`로 저장됨.
- PNG는 사용자 제공 브랜딩 이미지를 크림 배경 정사각 캔버스에 중앙 배치해 생성.

## 07. 남은 작업

- [ ] iOS/Android PWA 삭제 후 재설치로 홈 화면 아이콘 확인 (담당: 소장님)

## 08. 핸드오프 메모

- Cursor에게: 없음
- Codex에게: 실기기 아이콘 표시 QA
- 주의사항: 홈 화면 아이콘은 PWA 캐시 때문에 재설치가 가장 확실함

## 09. Git

- 커밋 해시: (미요청)
- push 여부: (미요청)
- 배포 여부: (미요청)
