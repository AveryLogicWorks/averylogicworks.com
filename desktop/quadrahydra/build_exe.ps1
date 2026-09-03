#Requires -Version 5.1
# Copyright (c) 2026 Avery Logic Works. All rights reserved.
# Developer rebuild only. The delivered EXE already works without a compiler.
[CmdletBinding()]
param([string]$ZigPath = 'zig')
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not (Get-Command $ZigPath -ErrorAction SilentlyContinue)) {
        throw 'Rebuilding launcher.c requires Zig 0.13.0. Supply -ZigPath with its path. End users can run the included QuadraHydra.exe directly.'
    }
    & $ZigPath cc -target x86_64-windows-gnu -Os -s -municode '-Wl,--subsystem,windows' -Wall -Wextra -Werror launcher.c -lshell32 -lole32 -o QuadraHydra.exe
    if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
    Write-Host 'Built QuadraHydra.exe. Keep it beside both QuadraHydra PowerShell scripts.'
} finally { Pop-Location }
