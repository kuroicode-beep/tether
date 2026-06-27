# Tether 프로젝트 위키

Tether는 커플 2명이 채팅, 상태, 교환일기, 사진첩, 콘텐츠, 자료실, 링크공유, 데이트 레시피, 같이듣기를 한 공간에서 공유하는 PWA 앱이다.

이 문서는 Outline에서 Tether 프로젝트 문서를 위키처럼 찾기 위한 최상위 목차다.

## 01. 빠른 링크

- [Tether PRD](/doc/tether-prd-HJekaI7nU1)
- [Tether 구현 스펙](/doc/tether-Codkkh22IC)
- [Tether 아키텍처](/doc/tether-vUkf82qjdn)
- [Tether 개발진행 히스토리](/doc/tether-9S7XLSjLsP)
- [Tether 완료보고서 인덱스](/doc/tether-88rNEPEgsY)

## 02. 현재 기준

- 현재 앱 버전: v0.5.10
- 운영 URL: https://tether-d1dab.web.app
- 저장소 문서 기준 위치: `C:\Projects\tether\docs`
- 보고서 기록 원칙: Notion 대신 프로젝트 `docs/` Markdown 저장
- 버전 규칙:
  - 핫픽스/마이너 수정: patch `+0.0.1`
  - 메인 업데이트: minor `+0.1.0`
  - 정식 출시/대규모 리뉴얼: major 변경

## 03. 문서 구조

### Tether PRD

제품 목표, 사용자, 기능 범위, 성공 기준, 리스크를 정리한다.

### Tether 구현 스펙

라우팅, 데이터 모델, 주요 훅, 화면 스펙, 보안 규칙, 접근성 기준을 정리한다.

### Tether 아키텍처

프론트엔드, Firebase, Firestore/Storage/Functions, PWA/알림, 세션 구조를 한눈에 볼 수 있게 정리한다.

### Tether 개발진행 히스토리

v0.2.0부터 v0.5.10까지의 주요 업데이트 흐름과 의사결정을 정리한다.

### Tether 완료보고서 인덱스

Cursor 완료보고서와 Codex 검증보고서를 버전/날짜별로 찾아볼 수 있게 묶는다.

## 04. 운영 메모

- iOS PWA 푸시는 브라우저 정책 영향을 받으므로 실기기 QA와 자동 검증을 분리한다.
- 고대비/다크 모드는 기본 준수 대상이다.
- 자료실 파일은 `couples/{coupleId}/files` 인덱스를 기준으로 안정 표시한다.
- 같이듣기 플레이어는 선택된 곡 후보를 전체 랜덤 반복 재생한다.
- `npm run lint`, `npm run build`, Functions build, rules/storage dry-run을 기본 자동 검증 게이트로 유지한다.
- Google-only 정책 이후 live Firebase E2E는 Admin SDK seed + custom token 방식이며, 실행에는 Firebase Admin credential이 필요하다.
