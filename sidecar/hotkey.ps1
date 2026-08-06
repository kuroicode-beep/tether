# sidecar/hotkey.ps1
# 전역 단축키를 등록하고, 눌릴 때마다 stdout으로 HOTKEY 한 줄을 내보낸다.
# Node(sidecar/index.js)가 이 출력을 읽어 채팅 화면을 연다.
# Modifiers: ALT=1, CONTROL=2, SHIFT=4, WIN=8, NOREPEAT=16384

param(
  [int]$Modifiers = 16393,  # WIN(8) + ALT(1) + NOREPEAT(16384)
  [int]$Key = 0x51          # Q
)

$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class TetherHotkey {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

  [DllImport("user32.dll")]
  public static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

  [StructLayout(LayoutKind.Sequential)]
  public struct MSG {
    public IntPtr hwnd;
    public uint message;
    public IntPtr wParam;
    public IntPtr lParam;
    public uint time;
    public int ptX;
    public int ptY;
  }
}
"@

$HOTKEY_ID = 1
$WM_HOTKEY = 0x0312

# 다른 앱이 이미 같은 조합을 점유하고 있으면 등록에 실패한다
if (-not [TetherHotkey]::RegisterHotKey([IntPtr]::Zero, $HOTKEY_ID, $Modifiers, $Key)) {
  $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  [Console]::Out.WriteLine("ERROR:register_failed:$code")
  [Console]::Out.Flush()
  exit 1
}

[Console]::Out.WriteLine('READY')
[Console]::Out.Flush()

try {
  $msg = New-Object TetherHotkey+MSG
  while ([TetherHotkey]::GetMessage([ref]$msg, [IntPtr]::Zero, 0, 0) -gt 0) {
    if ($msg.message -eq $WM_HOTKEY) {
      [Console]::Out.WriteLine('HOTKEY')
      [Console]::Out.Flush()
    }
  }
} finally {
  [void][TetherHotkey]::UnregisterHotKey([IntPtr]::Zero, $HOTKEY_ID)
}
