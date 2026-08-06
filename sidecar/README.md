# Tether Sidecar (Windows)

Tether 알림을 크롬/FCM 경로 없이 Firestore에서 직접 수신해 윈도우 네이티브 토스트로 표시하는 상주 프로세스입니다.

- 크롬이 꺼져 있어도 알림 수신
- 앱에서 설정한 커스텀 알림음(gentleKnock 등) 그대로 재생
- 알림 설정(메시지/상태/일기 on/off)은 Firestore `users/{uid}.notificationSettings`와 실시간 동기화
- 토스트 클릭 시 Tether PWA 열기
- 전역 단축키(기본 `Win + Alt + Q`)로 어디서든 채팅 화면 바로 열기

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

## 단축키

기본값은 `Win + Alt + Q`이며, 누르면 이미 열려 있는 Tether 창을 앞으로 가져옵니다.
열려 있는 창이 없으면 채팅 화면으로 새로 열면서 **PIN 입력을 건너뜁니다.**

PIN 건너뛰기는 이 PC에서 실제로 단축키를 누른 경우에만 동작합니다.
사이드카가 30초짜리 1회용 토큰을 발급해 주소에 붙이고, 앱은 그 토큰을
`127.0.0.1:48620`의 사이드카에 되물어 확인합니다. 로컬에서만 검증되므로
다른 기기에서 주소를 그대로 복사해도 잠금이 풀리지 않고, 토큰은 한 번
쓰면 폐기되어 주소창 기록이 남아도 재사용되지 않습니다.

`config.json`에서 변경할 수 있습니다.

```json
{ "hotkey": "Win+Alt+Q" }
```

- 조합 키: `Win`, `Alt`, `Ctrl`, `Shift` (하나 이상 필요)
- 일반 키: 영문/숫자 한 글자 또는 `F1`~`F12`
- `"hotkey": false` — 단축키 기능 끄기

다른 프로그램이 같은 조합을 이미 쓰고 있으면 등록에 실패하고 `sidecar.log`에
`hotkey_register_failed`가 남습니다. 이 경우 다른 조합으로 바꿔주세요.
단축키 등록이 실패해도 알림 기능은 그대로 동작합니다.

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
