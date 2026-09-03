#Requires -Version 5.1
# Copyright (c) 2026 Avery Logic Works. All rights reserved.
[CmdletBinding()]
param(
    [string]$AppDirectory = $PSScriptRoot,
    [string]$LogPath,
    [switch]$AdminActivated
)

$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Windows.Forms
    if ([Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') {
        throw 'Start QuadraHydra.exe or Launch-QuadraHydra-Diagnostics.bat so Windows Forms runs in STA mode.'
    }
    if (-not $LogPath) {
        $logDirectory = Join-Path $env:LOCALAPPDATA 'AveryLogicWorks\QuadraHydra\Logs'
        New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
        $LogPath = Join-Path $logDirectory ('diagnostics-{0}-{1}.log' -f (Get-Date -Format yyyyMMdd-HHmmss), $PID)
        Start-Transcript -Path $LogPath -Force | Out-Null
        $transcribing = $true
    }
    Write-Output ('QuadraHydra 1.0.3 | {0:o} | PowerShell {1}' -f (Get-Date), $PSVersionTable.PSVersion)
    & (Join-Path $AppDirectory 'QuadraHydra-ControlPanel.ps1') -AppDirectory $AppDirectory -AdminActivated:$AdminActivated
} catch {
    Write-Output ('Startup failure: {0}' -f $_.Exception.Message)
    Write-Output $_.ScriptStackTrace
    exit 1
} finally {
    if ($transcribing) { Stop-Transcript -ErrorAction SilentlyContinue | Out-Null }
}
