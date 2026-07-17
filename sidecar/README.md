# Tether Sidecar (Windows)

Tether 알림을 크롬/FCM 경로 없이 Firestore에서 직접 수신해 윈도우 네이티브 토스트로 표시하는 상주 프로세스입니다.

- 크롬이 꺼져 있어도 알림 수신
- 앱에서 설정한 커스텀 알림음(gentleKnock 등) 그대로 재생
- 알림 설정(메시지/상태/일기 on/off)은 Firestore `users/{uid}.notificationSettings`와 실시간 동기화
- 토스트 클릭 시 Tether PWA 열기

## 요구사항

- Node.js
- `firebase login` 완료 상태 (CLI 로그인 토큰을 재사용하므로 별도 시크릿 저장 없음)

## 설치

```bash
cd sidecar
npm install
copy config.example.json config.json   # 값 채우기 (myUid, coupleId)
```

## 실행

```bash
node index.js          # 콘솔 모드 (로그 확인용)
wscript start-hidden.vbs   # 백그라운드 모드 (콘솔 창 없음)
```

## 윈도우 시작 시 자동 실행

1. `Win + R` → `shell:startup`
2. 열린 폴더에 `start-hidden.vbs` 바로가기 붙여넣기

## 로그

`sidecar.log` — 이벤트 타입/시각만 기록하며 메시지 본문 등 개인정보는 기록하지 않습니다.

## 종료

작업 관리자에서 `node.exe` (tether-sidecar) 종료, 또는:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*sidecar*' } | ForEach-Object { Stop-Process -Id $_.ProcessId }
```
