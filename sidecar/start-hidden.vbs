' sidecar/start-hidden.vbs — 콘솔 창 없이 사이드카를 백그라운드로 실행한다
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.Run "cmd /c node index.js >> sidecar.log 2>&1", 0, False
