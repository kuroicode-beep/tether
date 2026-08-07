# sidecar/ime-hangul.ps1
# 전경 창이 Tether(브라우저/PWA)일 때 그 창의 IME를 한글 모드로 전환한다.
# 웹에는 OS 입력기 상태를 바꾸는 API가 없어, 로컬 사이드카가 대신 수행한다.
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class IMEUtil {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder t, int c);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("imm32.dll")]  public static extern IntPtr ImmGetDefaultIMEWnd(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr wParam, IntPtr lParam);
}
"@

$h = [IMEUtil]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[void][IMEUtil]::GetWindowText($h, $sb, 256)
$procId = 0
[void][IMEUtil]::GetWindowThreadProcessId($h, [ref]$procId)
$p = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName

# 다른 앱의 입력기를 건드리지 않도록 Tether 창일 때만 동작한다
if ($p -notmatch '^(chrome|msedge)$' -or -not $sb.ToString().StartsWith('Tether')) {
  Write-Output 'SKIP:not_tether'
  exit 0
}

$ime = [IMEUtil]::ImmGetDefaultIMEWnd($h)
if ($ime -eq [IntPtr]::Zero) {
  Write-Output 'SKIP:no_ime'
  exit 0
}

# WM_IME_CONTROL(0x283) — IMC_SETOPENSTATUS(0x006)=1: IME 켬,
# IMC_SETCONVERSIONMODE(0x002)=1(IME_CMODE_NATIVE): 한글 모드
[void][IMEUtil]::SendMessage($ime, 0x283, [IntPtr]0x006, [IntPtr]1)
[void][IMEUtil]::SendMessage($ime, 0x283, [IntPtr]0x002, [IntPtr]1)
Write-Output 'OK:1'
