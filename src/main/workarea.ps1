param(
    [int]$left = -1,
    [int]$right = -1
)

Add-Type @"
using System;
using System.Runtime.InteropServices;

public struct RECT {
    public int Left, Top, Right, Bottom;
}

public class WorkArea {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, ref RECT pvParam, uint fWinIni);

    public static void Modify(int targetLeft, int targetRight) {
        RECT currentRect = new RECT();

        // 1. Read the CURRENT system-approved work area metrics (SPI_GETWORKAREA = 0x0030)
        // This means we dynamically capture your exact native taskbar height setup!
        SystemParametersInfo(0x0030, 0, ref currentRect, 0);

        // 2. Inject your custom horizontal bounds over the existing ones
        if (targetLeft != -1) {  currentRect.Left = targetLeft; }
        if (targetRight != -1) { currentRect.Right = targetRight; }

        // 3. Commit ALL FOUR sides back to Windows together (SPI_SETWORKAREA = 0x002F)
        // Windows requires a fully validated, complete 4-point RECT structure to apply.
        SystemParametersInfo(0x002F, 0, ref currentRect, 0x01);
    }
}
"@

# Run the compiled layout logic safely
[WorkArea]::Modify($left, $right)
