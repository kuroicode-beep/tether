# sidecar/focus-window.ps1
# 이미 열려 있는 Tether 창을 앞으로 가져온다. 없으면 FOUND:0을 반환해
# Node가 새 창을 열도록 한다.

param([string]$TitlePrefix = 'Tether')

$ErrorActionPreference = 'SilentlyContinue'

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class TetherWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@

$SW_RESTORE = 9

# PWA 창은 chrome/msedge 프로세스이며 창 제목이 "Tether"로 시작한다
$target = Get-Process -Name chrome, msedge |
  Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "$TitlePrefix*" } |
  Select-Object -First 1

if (-not $target) {
  Write-Output 'FOUND:0'
  exit 0
}

$handle = $target.MainWindowHandle
if ([TetherWin]::IsIconic($handle)) { [void][TetherWin]::ShowWindow($handle, $SW_RESTORE) }
$ok = [TetherWin]::SetForegroundWindow($handle)

if ($ok) { Write-Output 'FOUND:1' } else { Write-Output 'FOUND:0' }
