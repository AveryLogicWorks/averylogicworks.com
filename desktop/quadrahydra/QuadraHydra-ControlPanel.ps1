#Requires -Version 5.1
<#
    QuadraHydra(TM) Command Center
    Copyright (c) 2026 Avery Logic Works - All Rights Reserved
    Resource Priority Manager for Windows
    Purpose: Monitor, manage, and prioritize running processes to optimize
             video editing, rendering, and general workload performance.

    --- Terms of Use ---
    Use is governed by legal/TERMS_OF_SERVICE.md supplied with this build.
    Process changes can interrupt applications and lose unsaved data.
    Mandatory rights under applicable law remain unaffected.

    --- Build Metadata ---
    Build ID: QH-2026-0903-002
    Build Date: 2026-09-03
    Version: 1.0.3
#>

[CmdletBinding()]
param(
    [switch]$Elevated,
    [switch]$AdminActivated,
    [string]$AppDirectory = $PSScriptRoot,
    [string]$DataDirectory = (Join-Path $env:LOCALAPPDATA 'AveryLogicWorks\QuadraHydra')
)

. (Join-Path $AppDirectory 'QuadraHydra-Consent.ps1')
if (-not (Show-QuadraHydraAgreement -AppDirectory $AppDirectory -DataDirectory $DataDirectory)) { return }

$ErrorActionPreference = 'Stop'

# =============================================================================
#  CONFIGURATION & STATE
# =============================================================================
$script:AppName      = 'QuadraHydra(TM) Command Center'
$script:AppShortName = 'QuadraHydra'
$script:AppVersion   = '1.0.3'
$script:BuildID      = 'QH-2026-0903-002'
$script:BuildDate    = '2026-09-03'
$script:CompanyName  = 'Avery Logic Works'
$script:BasePath     = [IO.Path]::GetFullPath($AppDirectory)
$script:DataPath     = [IO.Path]::GetFullPath($DataDirectory)
New-Item -ItemType Directory -Path $script:DataPath -Force | Out-Null
$script:ConfigPath   = Join-Path $script:DataPath 'QuadraHydra-Config.json'
# Import existing settings once; never overwrite newer per-user state.
foreach ($legacyName in @('QuadraHydra-Config.json', 'QuadraHydra-License.dat')) {
    $legacyPath = Join-Path $script:BasePath $legacyName
    $newPath = Join-Path $script:DataPath $legacyName
    if ((Test-Path -LiteralPath $legacyPath) -and -not (Test-Path -LiteralPath $newPath)) {
        Copy-Item -LiteralPath $legacyPath -Destination $newPath
    }
}
$tempDir = $env:TEMP
if (-not $tempDir -or -not (Test-Path $tempDir -ErrorAction SilentlyContinue)) {
    $tempDir = $env:LOCALAPPDATA
    if (-not $tempDir -or -not (Test-Path $tempDir -ErrorAction SilentlyContinue)) {
        $tempDir = $script:BasePath
    }
}

# Load .env file if present (next to script or EXE)
$envFile = Join-Path $script:BasePath '.env'
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
            $parts = $line -split '=', 2
            $key = $parts[0].Trim()
            $val = $parts[1].Trim()
            if (-not (Get-Item -Path "Env:$key" -ErrorAction SilentlyContinue)) {
                Set-Item -Path "Env:$key" -Value $val
            }
        }
    }
}

# â”€â”€â”€ IP Watermark â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# ALW-QH-7F3A-2026-AVERYLOGICWORKS
# AVERY_LOGIC_WORKS_QUADRAHYDRA_PROPRIETARY_v1.0.0
# Copyright (c) 2026 Avery Logic Works - QuadraHydra(TM) - All Rights Reserved
# Unauthorized copying, modification, or distribution is prohibited.
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

$script:PriorityRules = @{}

# =============================================================================
#  LICENSE VALIDATION (One-Time Purchase)
# =============================================================================
$script:LicenseSecret = $env:QH_SECRET_KEY
if (-not $script:LicenseSecret) { $script:LicenseSecret = '' }
$script:LicensePath = Join-Path $script:DataPath 'QuadraHydra-License.dat'
$script:LicenseActivated = $false
$script:LicenseKey = ''
$script:IsTrialMode = $false
$script:TrialLengthDays = 3
$script:TrialDays = 3
$script:LicensePublicKey = '<RSAKeyValue><Modulus>voLUQZvD5D9iuYCq0BaQko+XvC9ACJ7gEEiheQmZOwk/LDgk1do3il4v/Hfp7KrwmUDF5konx6QzZBuBniJkdUnzf0+r9oikFTh93cDAAolTv5c9k/U2Oq1ZJasVlR9xsziHMNUlX/O0A3XpDz4eK6Anj0QeijZzIvY8zRHlSq6j4Q/bYkNaVpDPPSdnQeBufn8pO2AeXjg5CBSQ5WK6kG6e/ShdJBzskzlJrv0PiGO6MeS10ZzhHSfalbtL7ZckwmkXFXD7qZsavTHwKCafTNpfNbZI4Cu+vs7/iMK20FQFxy1qf46EVHPaY2sX+TfMZu5sf0UkFJaQeEM9Yu+FY/9jaLLace3lSHsNggcHC7QkST7poyEQmCWuGqA4DIUhfb7P4a4S5luHzOmfiYBpV8Ebq6SasNeeJJqwk0Kx6wPpyaX96dIiCiezm+xfr7POBo522McDKnOK659j/3oFiTm/VTAtSG2lZMQFziXRyY/sZ5Os2+pI7mImON1eMqvb</Modulus><Exponent>AQAB</Exponent></RSAKeyValue>'
$script:TrialPath = Join-Path $script:DataPath 'trial.dat'
$legacyTrial = Join-Path $tempDir 'QuadraHydra\trial.dat'
if ((Test-Path -LiteralPath $legacyTrial) -and -not (Test-Path -LiteralPath $script:TrialPath)) {
    Copy-Item -LiteralPath $legacyTrial -Destination $script:TrialPath
}

function Test-SignedLicense([string]$Key) {
    $script:LastLicenseError = 'Invalid license key. Check that the entire key was pasted.'
    try {
        $parts = ($Key -replace '\s','').Split('.')
        if ($parts.Count -ne 3 -or $parts[0] -cne 'QH1' -or $Key.Length -gt 8192) { return $false }
        $payloadBytes = [Convert]::FromBase64String($parts[1])
        $signature = [Convert]::FromBase64String($parts[2])
        $rsa = [Security.Cryptography.RSA]::Create()
        try {
            $rsa.FromXmlString($script:LicensePublicKey)
            if (-not $rsa.VerifyData($payloadBytes, $signature,
                [Security.Cryptography.HashAlgorithmName]::SHA256,
                [Security.Cryptography.RSASignaturePadding]::Pkcs1)) { return $false }
        } finally { $rsa.Dispose() }
        $payload = [Text.Encoding]::UTF8.GetString($payloadBytes) | ConvertFrom-Json -ErrorAction Stop
        if ($payload.product -cne 'QuadraHydra' -or $payload.edition -cne 'Lifetime' -or
            $payload.id -notmatch '^[0-9a-f]{32}$') { return $false }
        $script:LastLicenseError = ''
        return $true
    } catch { return $false }
}

function Test-LicenseValid {
    $candidates = @($script:LicensePath)
    if ($script:BasePath) { $candidates += (Join-Path $script:BasePath 'QuadraHydra-License.dat') }
    foreach ($candidate in @($candidates | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $candidate)) { continue }
        try {
            $data = Get-Content -LiteralPath $candidate -Raw | ConvertFrom-Json -ErrorAction Stop
            if (-not $data.Key) { continue }
            if ($data.Key.StartsWith('QH1.')) {
                if (-not (Test-SignedLicense $data.Key)) { continue }
            } else {
                # Compatibility for an existing owner installation with its old secret.
                if (-not $script:LicenseSecret -or -not $data.Signature) { continue }
                $hmac = New-Object System.Security.Cryptography.HMACSHA256
                try {
                    $hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($script:LicenseSecret)
                    $expected = [System.BitConverter]::ToString($hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($data.Key))).Replace('-','')
                } finally { $hmac.Dispose() }
                if ($expected -ne $data.Signature) { continue }
            }
            if ($candidate -ne $script:LicensePath) {
                Copy-Item -LiteralPath $candidate -Destination $script:LicensePath -Force
            }
            $script:LicenseKey = $data.Key
            $script:LicenseActivated = $true
            return $true
        } catch { }
    }
    return $false
}

function Get-TrialWindow($Trial, [datetimeoffset]$Now = [datetimeoffset]::UtcNow) {
    try {
        if (-not $Trial.StartDate -or -not $Trial.Expiry) { return $null }
        $start = [datetimeoffset]::Parse($Trial.StartDate).ToUniversalTime()
        $storedExpiry = [datetimeoffset]::Parse($Trial.Expiry).ToUniversalTime()
        $limit = $start.AddDays(3)
        $expiry = if ($storedExpiry -lt $limit) { $storedExpiry } else { $limit }
        # A restarted app must not turn a future-dated or expired trial into new time.
        if ($start -gt $Now -or $expiry -le $start) { return $null }
        return [pscustomobject]@{ Active = ($Now -lt $expiry); Expiry = $expiry; Start = $start }
    } catch { return $null }
}

function Test-TrialActive {
    $script:IsTrialMode = $false
    if (Test-Path -LiteralPath $script:TrialPath) {
        try {
            $trial = Get-Content -LiteralPath $script:TrialPath -Raw | ConvertFrom-Json -ErrorAction Stop
            $window = Get-TrialWindow $trial
            if ($window -and $window.Active) {
                $script:IsTrialMode = $true
                $script:TrialDays = [math]::Ceiling(($window.Expiry - [datetimeoffset]::UtcNow).TotalDays)
                return $true
            }
        } catch { }
    }
    return $false
}

function Test-SessionAccess {
    return ($script:LicenseActivated -or (Test-TrialActive))
}

function Start-Trial {
    if (Test-Path -LiteralPath $script:TrialPath) {
        if (Test-TrialActive) { return }
        throw 'The three-day trial has ended or cannot be verified. Enter a purchased license to continue.'
    }
    $dir = Split-Path $script:TrialPath -Parent
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $start = [datetimeoffset]::UtcNow
    $trial = @{ StartDate = $start.ToString('o'); Expiry = $start.AddDays(3).ToString('o') }
    $trial | ConvertTo-Json | Set-Content $script:TrialPath -Encoding UTF8
    $script:TrialDays = 3
    $script:IsTrialMode = $true
}

function Save-License([string]$Key) {
    if ($Key.StartsWith('QH1.')) {
        $Key = $Key -replace '\s',''
        if (-not (Test-SignedLicense $Key)) { throw $script:LastLicenseError }
        @{ Key = $Key; Format = 'QH1'; ActivatedDate = (Get-Date).ToString('o') } |
            ConvertTo-Json | Set-Content $script:LicensePath -Encoding UTF8
        $script:LicenseKey = $Key
        $script:LicenseActivated = $true
        return
    }
    if (-not $script:LicenseSecret) { throw 'License validation is not configured.' }
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($script:LicenseSecret)
    $sig = [System.BitConverter]::ToString($hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Key))).Replace('-','')
    $hmac.Dispose()
    $lic = @{ Key = $Key; Signature = $sig; ActivatedDate = (Get-Date).ToString('o') }
    $lic | ConvertTo-Json | Set-Content $script:LicensePath -Encoding UTF8
    $script:LicenseKey = $Key
    $script:LicenseActivated = $true
}

function Show-LicenseDialog {
    $dlg = New-Object System.Windows.Forms.Form
    $dlg.Text = 'QuadraHydra(TM) License Activation'
    $dlg.Size = New-Object System.Drawing.Size(480, 280)
    $dlg.StartPosition = 'CenterParent'
    $dlg.FormBorderStyle = 'FixedDialog'
    $dlg.MaximizeBox = $false
    $dlg.MinimizeBox = $false
    $dlg.BackColor = [System.Drawing.Color]::FromArgb(30, 30, 40)
    $dlg.ForeColor = [System.Drawing.Color]::FromArgb(220, 220, 230)
    $dlg.Font = $form.Font

    $lblTitle = New-Object System.Windows.Forms.Label
    $lblTitle.Text = 'Enter your QuadraHydra(TM) License Key'
    $lblTitle.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
    $lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(0, 180, 220)
    $lblTitle.Location = New-Object System.Drawing.Point(20, 15)
    $lblTitle.AutoSize = $true
    $dlg.Controls.Add($lblTitle)

    $lblSub = New-Object System.Windows.Forms.Label
    $lblSub.Text = "Paste the complete license key provided with your purchase.`nNew keys begin with QH1."
    $lblSub.Location = New-Object System.Drawing.Point(20, 45)
    $lblSub.Size = New-Object System.Drawing.Size(430, 35)
    $lblSub.ForeColor = [System.Drawing.Color]::FromArgb(180, 180, 190)
    $dlg.Controls.Add($lblSub)

    $txtKey = New-Object System.Windows.Forms.TextBox
    $txtKey.Location = New-Object System.Drawing.Point(20, 90)
    $txtKey.Size = New-Object System.Drawing.Size(430, 25)
    $txtKey.BackColor = [System.Drawing.Color]::FromArgb(50, 50, 65)
    $txtKey.ForeColor = [System.Drawing.Color]::White
    $txtKey.BorderStyle = 'FixedSingle'
    $txtKey.Font = New-Object System.Drawing.Font('Consolas', 11)
    $dlg.Controls.Add($txtKey)

    $lblResult = New-Object System.Windows.Forms.Label
    $lblResult.Text = ''
    $lblResult.Location = New-Object System.Drawing.Point(20, 125)
    $lblResult.Size = New-Object System.Drawing.Size(430, 30)
    $lblResult.ForeColor = [System.Drawing.Color]::FromArgb(255, 80, 80)
    $dlg.Controls.Add($lblResult)

    $btnActivate = New-Object System.Windows.Forms.Button
    $btnActivate.Text = 'Activate'
    $btnActivate.Location = New-Object System.Drawing.Point(280, 165)
    $btnActivate.Size = New-Object System.Drawing.Size(80, 30)
    $btnActivate.FlatStyle = 'Flat'
    $btnActivate.BackColor = [System.Drawing.Color]::FromArgb(0, 120, 60)
    $btnActivate.ForeColor = [System.Drawing.Color]::White
    $dlg.Controls.Add($btnActivate)

    $btnTrial = New-Object System.Windows.Forms.Button
    $btnTrial.Text = "Start $($script:TrialDays)-Day Trial"
    if (Test-Path -LiteralPath $script:TrialPath) {
        $btnTrial.Enabled = $false
        $btnTrial.Text = 'Trial Used'
    }
    $btnTrial.Location = New-Object System.Drawing.Point(170, 165)
    $btnTrial.Size = New-Object System.Drawing.Size(100, 30)
    $btnTrial.FlatStyle = 'Flat'
    $btnTrial.BackColor = [System.Drawing.Color]::FromArgb(60, 60, 80)
    $btnTrial.ForeColor = [System.Drawing.Color]::White
    $dlg.Controls.Add($btnTrial)

    $btnCancel = New-Object System.Windows.Forms.Button
    $btnCancel.Text = 'Cancel'
    $btnCancel.Location = New-Object System.Drawing.Point(370, 165)
    $btnCancel.Size = New-Object System.Drawing.Size(80, 30)
    $btnCancel.FlatStyle = 'Flat'
    $btnCancel.BackColor = [System.Drawing.Color]::FromArgb(80, 80, 90)
    $btnCancel.ForeColor = [System.Drawing.Color]::White
    $btnCancel.DialogResult = 'Cancel'
    $dlg.Controls.Add($btnCancel)

    $btnActivate.Add_Click({
        $key = $txtKey.Text.Trim()
        if (-not $key) { $lblResult.Text = 'Please enter a license key.'; return }
        if ($key.StartsWith('QH1.')) {
            try { Save-License $key } catch { $lblResult.Text = $_.Exception.Message; return }
            $dlg.DialogResult = 'OK'
            return
        }
        $key = $key.ToUpperInvariant()
        # Validate key format: 24 hex chars in 6 groups of 4
        $clean = $key -replace '-',''
        if ($clean.Length -ne 24 -or $clean -notmatch '^[0-9A-F]+$') {
            $lblResult.Text = 'Invalid key format. Expected XXXX-XXXX-XXXX-XXXX-XXXX-XXXX.'
            return
        }
        # Verify HMAC signature (last 8 chars = signature, first 16 = payload)
        $payload = $clean.Substring(0, 16)
        $sigPart = $clean.Substring(16, 8)
        if (-not $script:LicenseSecret) {
            $lblResult.Text = 'This legacy key needs a replacement key from Avery Logic Works.'
            return
        }
        $hmac = New-Object System.Security.Cryptography.HMACSHA256
        $hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($script:LicenseSecret)
        $expected = [System.BitConverter]::ToString($hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($payload))).Replace('-','').Substring(0, 8)
        $hmac.Dispose()
        if ($sigPart -ne $expected) {
            $lblResult.Text = 'Invalid license key. Please check and try again.'
            return
        }
        try { Save-License $key } catch { $lblResult.Text = $_.Exception.Message; return }
        $lblResult.ForeColor = [System.Drawing.Color]::FromArgb(0, 220, 100)
        $lblResult.Text = 'License activated successfully! Click Close to continue.'
        $btnActivate.Enabled = $false
        $btnTrial.Enabled = $false
        $dlg.DialogResult = 'OK'
    })

    $btnTrial.Add_Click({
        try { Start-Trial } catch { $lblResult.Text = $_.Exception.Message; return }
        $lblResult.ForeColor = [System.Drawing.Color]::FromArgb(0, 220, 100)
        $lblResult.Text = "$($script:TrialDays)-day trial started! Click Close to continue."
        $btnActivate.Enabled = $false
        $btnTrial.Enabled = $false
        $dlg.DialogResult = 'OK'
    })

    $result = $dlg.ShowDialog($form)
    $dlg.Dispose()
    return ($result -eq 'OK')
}

# Check license on startup
$script:LicenseValid = Test-LicenseValid
if (-not $script:LicenseValid) {
    $script:LicenseValid = Test-TrialActive
}

# =============================================================================
#  AUTO-UPDATE CHECKER
# =============================================================================
$script:UpdateManifestURL = 'https://esoiezxddkqlmvsgscqw.supabase.co/storage/v1/object/public/releases/quadrahydra-version.json'

function Check-ForUpdates {
    param([bool]$Silent = $true)
    try {
        $resp = Invoke-RestMethod -Uri $script:UpdateManifestURL -TimeoutSec 10 -ErrorAction Stop
        $latest = $resp.latest_version
        if (-not $latest) { return $false }
        # Compare versions
        $currentParts = $script:AppVersion.Split('.')
        $latestParts = $latest.Split('.')
        $isNewer = $false
        for ($i = 0; $i -lt [math]::Max($currentParts.Length, $latestParts.Length); $i++) {
            $c = if ($i -lt $currentParts.Length) { [int]$currentParts[$i] } else { 0 }
            $l = if ($i -lt $latestParts.Length) { [int]$latestParts[$i] } else { 0 }
            if ($l -gt $c) { $isNewer = $true; break }
            if ($l -lt $c) { break }
        }
        if (-not $isNewer) {
            if (-not $Silent) {
                [System.Windows.Forms.MessageBox]::Show(
                    "QuadraHydra(TM) is up to date.`n`nCurrent version: $($script:AppVersion)`nLatest version: $latest",
                    'Up to Date', 'OK', 'Information') | Out-Null
            }
            return $false
        }
        # New version available
        $msg = "A new version of QuadraHydra(TM) is available!`n`nYour version: $($script:AppVersion)`nLatest version: $latest"
        if ($resp.release_notes) { $msg += "`n`nWhat's new:`n$($resp.release_notes)" }
        $msg += "`n`nWould you like to download the update?"
        $r = [System.Windows.Forms.MessageBox]::Show($msg, 'Update Available', 'YesNo', 'Information')
        if ($r -eq 'Yes') {
            $url = if ($resp.download_url) { $resp.download_url } else { 'https://averylogicworks.com/downloads' }
            Start-Process $url
        }
        return $true
    } catch {
        if (-not $Silent) {
            [System.Windows.Forms.MessageBox]::Show(
                "Could not check for updates. Check your internet connection or visit averylogicworks.com.",
                'Update Check Failed', 'OK', 'Warning') | Out-Null
        }
        return $false
    }
}

$script:IsAdmin      = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$script:AdminMode    = $script:IsAdmin -and $AdminActivated

$script:ProtectedProcesses = @(
    'explorer','svchost','lsass','services','csrss','smss','wininit','winlogon',
    'fontdrvhost','dwm','runtimebroker','searchindexer','audiodg','AudioEndpointBuilder',
    'RustDesk','rustdesk','TeamViewer','teamviewer','AnyDesk','anydesk','Parsec','parsec',
    'spoolsv','dns','dhcp','wuauserv','bits','TermService','RpcSs','PlugPlay','Power',
    'SessionEnv','TabletInputService','NlaSvc','netprofm','nsi','mpssvc','fdrespub','fdhost',
    'bdfsvc','BrokerInfrastructure','DeviceAssociationService','DisplayEnhancementService',
    'StateRepository','SystemEventsBroker','TimeBrokerSvc','UserManager','CoreMessaging',
    'ShellExperienceHost','StartMenuExperienceHost','SearchUI','SecurityHealthService'
)

$script:VideoEditors = @(
    'adobe premiere pro','premiere pro','premiere','afterfx','after effects',
    'resolve','davinci resolve','vegas','vegas pro','hitfilm','camtasia',
    'filmora','powerdirector','pinnacle','edius','avid','mediacomposer',
    'kdenlive','shotcut','openshot','blender','cinema 4d','c4d','maya','3dsmax',
    'handbrake','ffmpeg','obs64','obs32','obs'
)

$script:PrevCpuTimes = @{}
$script:PrevSnapTime = $null
$script:CurrentProfile = 'Normal Mode'
$script:VideoEditorDetected = $false
$script:ShowBalloon = $true
$script:CachedProcs = @()
$script:TrayIcon = $null
$script:UpdateJob = $null
$script:UpdateTimer = $null

function Clear-UpdateJob {
    if ($script:UpdateTimer) {
        $script:UpdateTimer.Stop()
        $script:UpdateTimer.Dispose()
        $script:UpdateTimer = $null
    }
    if ($script:UpdateJob) {
        Remove-Job -Job $script:UpdateJob -Force -ErrorAction SilentlyContinue
        $script:UpdateJob = $null
    }
}

# =============================================================================
#  LOAD / SAVE CONFIG
# =============================================================================
function Load-Config {
    if (Test-Path $script:ConfigPath) {
        try {
            $raw = Get-Content $script:ConfigPath -Raw | ConvertFrom-Json -ErrorAction Stop
            if ($raw.ProtectedProcesses) { $script:ProtectedProcesses = @($script:ProtectedProcesses + $raw.ProtectedProcesses | Select-Object -Unique) }
            if ($raw.PriorityRules)      { $script:PriorityRules      = $raw.PriorityRules }
            if ($null -ne $raw.WindowX)  { $script:WindowX = $raw.WindowX }
            if ($null -ne $raw.WindowY)  { $script:WindowY = $raw.WindowY }
            if ($null -ne $raw.WindowW)  { $script:WindowW = $raw.WindowW }
            if ($null -ne $raw.WindowH)  { $script:WindowH = $raw.WindowH }
        } catch { }
    }
}

function Save-Config {
    $cfg = @{
        ProtectedProcesses = $script:ProtectedProcesses
        PriorityRules      = $script:PriorityRules
        WindowX            = $form.Location.X
        WindowY            = $form.Location.Y
        WindowW            = $form.Width
        WindowH            = $form.Height
        LastRun            = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    }
    $cfg | ConvertTo-Json -Depth 5 | Set-Content $script:ConfigPath -Encoding UTF8
}

Load-Config

# =============================================================================
#  UTILITY FUNCTIONS
# =============================================================================
function Format-Bytes([long]$Bytes) {
    if     ($Bytes -ge 1TB) { '{0:N2} TB' -f ($Bytes/1TB) }
    elseif ($Bytes -ge 1GB) { '{0:N2} GB' -f ($Bytes/1GB) }
    elseif ($Bytes -ge 1MB) { '{0:N2} MB' -f ($Bytes/1MB) }
    elseif ($Bytes -ge 1KB) { '{0:N2} KB' -f ($Bytes/1KB) }
    else                    { "$Bytes B" }
}

function Get-SystemStats {
    try { $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop } catch { $os = $null }
    try { $cpu = (Get-CimInstance Win32_Processor -ErrorAction Stop | Select-Object -First 1).LoadPercentage } catch { $cpu = 0 }
    if ($null -eq $cpu) { $cpu = 0 }
    $totalRam = if ($os) { [long]$os.TotalVisibleMemorySize * 1KB } else { 0 }
    $freeRam  = if ($os) { [long]$os.FreePhysicalMemory * 1KB } else { 0 }
    $usedRam  = $totalRam - $freeRam
    $ramPct   = if ($totalRam -gt 0) { [math]::Round(($usedRam / $totalRam) * 100, 1) } else { 0 }

    try { $gpuInfo = Get-CimInstance Win32_VideoController -ErrorAction Stop | Where-Object { $_.AdapterRAM -gt 0 } | Select-Object -First 1 } catch { $gpuInfo = $null }
    $gpuVram  = if ($gpuInfo -and $gpuInfo.AdapterRAM) { [long]$gpuInfo.AdapterRAM } else { 0 }
    $gpuName  = if ($gpuInfo -and $gpuInfo.Name) { $gpuInfo.Name } else { 'N/A' }

    # Attempt GPU performance counters for shared memory (best-effort)
    $sharedGpu = 0
    try {
        $gpuEng = Get-Counter '\GPU Adapter Memory(*)\Shared Usage' -ErrorAction SilentlyContinue
        if ($gpuEng) { $sharedGpu = ($gpuEng.CounterSamples | Measure-Object CookedValue -Sum).Sum }
    } catch { }

    [PSCustomObject]@{
        CpuPct      = [int]$cpu
        RamUsed     = $usedRam
        RamTotal    = $totalRam
        RamPct      = $ramPct
        GpuVram     = $gpuVram
        GpuShared   = $sharedGpu
        GpuName     = $gpuName
    }
}

function Get-ProcessCpu([System.Diagnostics.Process]$proc, [datetime]$now) {
    $key = $proc.Id
    $prev = $script:PrevCpuTimes[$key]
    $pct = 0.0
    if ($prev -and $script:PrevSnapTime) {
        $secs = ($now - $script:PrevSnapTime).TotalSeconds
        if ($secs -gt 0) {
            try {
                $diff = ($proc.TotalProcessorTime - $prev).TotalSeconds
                $pct = [math]::Round(($diff / ($secs * [Environment]::ProcessorCount)) * 100, 1)
                if ($pct -lt 0) { $pct = 0 }
                if ($pct -gt 100 * [Environment]::ProcessorCount) { $pct = [math]::Round($pct / [Environment]::ProcessorCount, 1) }
            } catch { $pct = 0 }
        }
    }
    try { $script:PrevCpuTimes[$key] = $proc.TotalProcessorTime } catch { }
    $pct
}

function Get-ProcessData {
    $now = Get-Date
    $procs = Get-Process | Where-Object { $_.Id -gt 0 } | ForEach-Object {
        $cpu = Get-ProcessCpu $_ $now
        $ram = try { $_.WorkingSet64 } catch { 0 }
        $prio = try { $_.PriorityClass.ToString() } catch { 'Unavailable' }
        $startTicks = try { $_.StartTime.ToUniversalTime().Ticks } catch { 0L }
        $isProtected = ($_.Id -eq $PID) -or ($_.ProcessName -eq 'QuadraHydra') -or ($script:ProtectedProcesses -contains $_.ProcessName)
        $isEditor = $script:VideoEditors -contains $_.ProcessName
        [PSCustomObject]@{
            Name        = $_.ProcessName
            Id          = $_.Id
            StartTicks  = $startTicks
            Cpu         = $cpu
            Ram         = $ram
            RamStr      = (Format-Bytes $ram)
            Priority    = $prio
            IsProtected = $isProtected
            IsEditor    = $isEditor
            Proc        = $_
        }
    }
    $script:PrevSnapTime = $now
    # Prune dead PIDs from cache
    $alive = @($procs | Select-Object -ExpandProperty Id)
    @($script:PrevCpuTimes.Keys) | Where-Object { $alive -notcontains $_ } | ForEach-Object { $script:PrevCpuTimes.Remove($_) }
    $procs
}

function Resolve-TargetProcess($Target, [switch]$AllowProtectedPriority, [switch]$AllowRecovery) {
    if (-not $AllowRecovery -and -not (Test-SessionAccess)) { throw 'Your three-day trial has ended. Activate a purchased license to continue.' }
    if (-not $Target -or $Target.Id -le 0) { throw 'Select a running process first.' }
    if ($Target.Id -eq $PID -or $Target.Name -eq 'QuadraHydra') {
        throw 'QuadraHydra cannot modify its own running processes.'
    }
    $proc = Get-Process -Id $Target.Id -ErrorAction Stop
    if ($proc.ProcessName -ne $Target.Name -or $Target.StartTicks -le 0 -or
        $proc.StartTime.ToUniversalTime().Ticks -ne $Target.StartTicks) {
        throw 'The selected process has exited, changed, or cannot be verified. Refresh and select it again; administrator access may be required.'
    }
    if (($script:ProtectedProcesses -contains $proc.ProcessName) -and
        -not ($AllowProtectedPriority -and $script:AdminMode)) {
        throw 'This process is protected. Protected priority changes require Activate Admin Powers.'
    }
    return $proc
}

function Set-ProcessPriority($Target, [string]$PriorityName) {
    $script:LastProcessError = ''
    try {
        if ($PriorityName -notin @('Idle','BelowNormal','Normal','AboveNormal','High')) {
            throw 'Unsupported priority level.'
        }
        $proc = Resolve-TargetProcess -Target $Target -AllowProtectedPriority
        $proc.PriorityClass = [System.Diagnostics.ProcessPriorityClass]$PriorityName
        $proc.Refresh()
        if ($proc.PriorityClass.ToString() -ne $PriorityName) {
            throw 'Windows did not retain the requested priority.'
        }
        return $true
    } catch {
        $script:LastProcessError = $_.Exception.Message
        return $false
    }
}

# --- P/Invoke for Suspend/Resume process threads ---
$suspendCode = @'
using System;
using System.Runtime.InteropServices;

public class ProcessSuspender {
    [DllImport("kernel32.dll")]
    public static extern IntPtr OpenThread(uint dwDesiredAccess, bool bInheritHandle, uint dwThreadId);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint SuspendThread(IntPtr hThread);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint ResumeThread(IntPtr hThread);
    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr hObject);
    [DllImport("kernel32.dll")]
    public static extern bool Thread32First(IntPtr hSnapshot, ref THREADENTRY32 lpte);
    [DllImport("kernel32.dll")]
    public static extern bool Thread32Next(IntPtr hSnapshot, ref THREADENTRY32 lpte);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr CreateToolhelp32Snapshot(uint dwFlags, uint th32ProcessID);
    
    public const uint TH32CS_SNAPTHREAD = 0x00000004;
    public const uint THREAD_SUSPEND_RESUME = 0x0002;
    
    [StructLayout(LayoutKind.Sequential)]
    public struct THREADENTRY32 {
        public uint dwSize;
        public uint cntUsage;
        public uint th32ThreadID;
        public uint th32OwnerProcessID;
        public int tpBasePri;
        public int tpDeltaPri;
        public uint dwFlags;
    }
    
    public static bool SuspendProcess(int pid) {
        return ChangeProcess(pid, true);
    }

    public static bool ResumeProcess(int pid) {
        return ChangeProcess(pid, false);
    }

    private static bool ChangeProcess(int pid, bool suspend) {
        IntPtr snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0);
        if (snapshot == new IntPtr(-1)) return false;
        bool changed = false;
        bool failed = false;
        THREADENTRY32 te = new THREADENTRY32();
        te.dwSize = (uint)Marshal.SizeOf(typeof(THREADENTRY32));
        try {
            if (Thread32First(snapshot, ref te)) {
                do {
                    if (te.th32OwnerProcessID == (uint)pid) {
                        IntPtr hThread = OpenThread(THREAD_SUSPEND_RESUME, false, te.th32ThreadID);
                        if (hThread == IntPtr.Zero) { failed = true; continue; }
                        try {
                            uint result = suspend ? SuspendThread(hThread) : ResumeThread(hThread);
                            if (result == UInt32.MaxValue) failed = true;
                            else changed = true;
                        } finally { CloseHandle(hThread); }
                    }
                    te.dwSize = (uint)Marshal.SizeOf(typeof(THREADENTRY32));
                } while (Thread32Next(snapshot, ref te));
            }
        } finally { CloseHandle(snapshot); }
        return changed && !failed;
    }
}
'@
if (-not ('ProcessSuspender' -as [type])) { Add-Type -TypeDefinition $suspendCode -ErrorAction Stop }

function Suspend-Process([int]$ProcId) {
    try {
        return [ProcessSuspender]::SuspendProcess($ProcId)
    } catch { return $false }
}

function Resume-Process([int]$ProcId) {
    try {
        return [ProcessSuspender]::ResumeProcess($ProcId)
    } catch { return $false }
}

function Get-ProcessPath([int]$ProcId) {
    try {
        $proc = Get-Process -Id $ProcId -ErrorAction Stop
        $path = $proc.Path
        if ($path) { return $path }
    } catch { }
    return $null
}

function Show-AboutDialog {
    $dlg = New-Object System.Windows.Forms.Form
    $dlg.Text = "About $script:AppShortName"
    $dlg.Size = New-Object System.Drawing.Size(500, 420)
    $dlg.StartPosition = 'CenterParent'
    $dlg.FormBorderStyle = 'FixedDialog'
    $dlg.MaximizeBox = $false
    $dlg.MinimizeBox = $false
    $dlg.BackColor = [System.Drawing.Color]::FromArgb(30, 30, 40)
    $dlg.ForeColor = [System.Drawing.Color]::FromArgb(220, 220, 230)
    $dlg.Font = $form.Font

    $lblTitle = New-Object System.Windows.Forms.Label
    $lblTitle.Text = "$script:AppName"
    $lblTitle.Font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
    $lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(0, 180, 220)
    $lblTitle.Location = New-Object System.Drawing.Point(20, 15)
    $lblTitle.AutoSize = $true
    $dlg.Controls.Add($lblTitle)

    $lblInfo = New-Object System.Windows.Forms.Label
    $licStatus = if ($script:LicenseActivated) { 'Licensed' } elseif ($script:IsTrialMode) { "Trial Mode: $($script:TrialDays) day(s) remaining" } else { 'Unlicensed' }
    $lblInfo.Text = "Version: $script:AppVersion`nBuild ID: $script:BuildID`nBuild Date: $script:BuildDate`nLicense: $licStatus`nCopyright (c) 2026 $script:CompanyName`nAll Rights Reserved."
    $lblInfo.Location = New-Object System.Drawing.Point(20, 55)
    $lblInfo.Size = New-Object System.Drawing.Size(440, 100)
    $lblInfo.ForeColor = [System.Drawing.Color]::FromArgb(200, 200, 210)
    $dlg.Controls.Add($lblInfo)

    $lblTerms = New-Object System.Windows.Forms.Label
    altering process priorities. By using this software you acknowledge that you
    $lblTerms.Location = New-Object System.Drawing.Point(20, 140)
    $lblTerms.Size = New-Object System.Drawing.Size(440, 200)
    $lblTerms.ForeColor = [System.Drawing.Color]::FromArgb(180, 180, 190)
    $lblTerms.Font = New-Object System.Drawing.Font('Segoe UI', 8.5)
    $dlg.Controls.Add($lblTerms)

    $btnClose = New-Object System.Windows.Forms.Button
    $btnClose.Text = 'Close'
    $btnClose.Location = New-Object System.Drawing.Point(390, 350)
    $btnClose.Size = New-Object System.Drawing.Size(75, 28)
    $btnClose.FlatStyle = 'Flat'
    $btnClose.BackColor = [System.Drawing.Color]::FromArgb(60, 60, 80)
    $btnClose.ForeColor = [System.Drawing.Color]::White
    $btnClose.DialogResult = 'OK'
    $dlg.Controls.Add($btnClose)
    $dlg.AcceptButton = $btnClose

    [void]$dlg.ShowDialog($form)
    $dlg.Dispose()
}

function Show-BalloonTip([string]$Title, [string]$Message, [string]$Icon = 'Info') {
    if (-not $script:ShowBalloon) { return }
    if ($null -ne $script:TrayIcon) {
        try {
            $script:TrayIcon.BalloonTipTitle = $Title
            $script:TrayIcon.BalloonTipText = $Message
            $script:TrayIcon.BalloonTipIcon = $Icon
            $script:TrayIcon.ShowBalloonTip(3000)
        } catch { }
    }
}

function Log-Action([string]$Message) {
    $ts = Get-Date -Format 'HH:mm:ss'
    $text = "[$ts] $Message"
    Write-Host $text
    $script:logBox.Items.Insert(0, $text)
    if ($script:logBox.Items.Count -gt 200) { $script:logBox.Items.RemoveAt($script:logBox.Items.Count -1) }
}

function Report-ActionError([string]$Action, [string]$Details) {
    Log-Action "$Action failed: $Details"
    [System.Windows.Forms.MessageBox]::Show($form, "$Action failed.`n`n$Details", 'QuadraHydra', 'OK', 'Warning') | Out-Null
}

function Invoke-SelectedPriority([string]$PriorityName) {
    if ($listView.SelectedItems.Count -ne 1) {
        [System.Windows.Forms.MessageBox]::Show($form, 'Select one process from the list first.', 'No Selection', 'OK', 'Information') | Out-Null
        return
    }
    # Capture identity before opening a dialog; a later refresh cannot retarget it.
    $target = $listView.SelectedItems[0].Tag
    $wasRunning = $timer.Enabled
    $timer.Stop()
    try {
        if ($PriorityName -eq 'High') {
            $answer = [System.Windows.Forms.MessageBox]::Show($form,
                "Set '$($target.Name)' (PID $($target.Id)) to High priority?`n`nThis may make other applications less responsive under heavy load.",
                'Confirm High Priority', 'YesNo', 'Warning')
            if ($answer -ne 'Yes') { return }
        }
        if (Set-ProcessPriority -Target $target -PriorityName $PriorityName) {
            Log-Action "Set $($target.Name) (PID $($target.Id)) to $PriorityName priority."
            Refresh-Grid
        } else {
            Report-ActionError 'Priority change' $script:LastProcessError
        }
    } catch { Report-ActionError 'Priority change' $_.Exception.Message }
    finally { if ($wasRunning) { $timer.Start() } }
}

function Restart-Elevated {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = Join-Path $script:BasePath 'QuadraHydra.exe'
    if (-not (Test-Path -LiteralPath $psi.FileName)) {
        Report-ActionError 'Administrator restart' 'QuadraHydra.exe is missing. Extract the complete repair package first.'
        return
    }
    $psi.Arguments = '-AdminActivated'
    $psi.WorkingDirectory = $script:BasePath
    $psi.UseShellExecute = $true
    $psi.Verb = 'runas'
    try { Save-Config; [System.Diagnostics.Process]::Start($psi) | Out-Null }
    catch { Log-Action 'Administrator restart was cancelled or could not start.'; return }
    $form.Close()
}

# =============================================================================
#  PROFILE ENGINE
# =============================================================================
function Apply-Profile([string]$ProfileName) {
    $script:CurrentProfile = $ProfileName
    $procs = Get-ProcessData
    $success = 0
    $fail = 0

    switch ($ProfileName) {
        'Normal Mode' {
            foreach ($p in $procs) {
                if ($p.IsProtected) { continue }
                if (Set-ProcessPriority -Target $p -PriorityName 'Normal') { $success++ } else { $fail++ }
            }
            Log-Action "Applied Normal Mode: $success changed; $fail could not be changed."
            Show-BalloonTip 'QuadraHydra' 'Normal Mode applied. All priorities reset.' 'Info'
        }
        'Video Editing Mode' {
            foreach ($p in $procs) {
                if ($p.IsProtected) { continue }
                if ($p.IsEditor) {
                    if (Set-ProcessPriority -Target $p -PriorityName 'AboveNormal') { $success++ } else { $fail++ }
                } elseif ($p.Name -match 'chrome|firefox|edge|brave|opera|steam|discord|spotify') {
                    if (Set-ProcessPriority -Target $p -PriorityName 'BelowNormal') { $success++ } else { $fail++ }
                } else {
                    if (Set-ProcessPriority -Target $p -PriorityName 'Normal') { $success++ } else { $fail++ }
                }
            }
            Log-Action "Applied Video Editing Mode: $success changed; $fail could not be changed."
            Show-BalloonTip 'QuadraHydra' 'Video Editing Mode active. Editor favored, browsers restrained.' 'Info'
        }
        'Export / Render Mode' {
            foreach ($p in $procs) {
                if ($p.IsProtected) { continue }
                if ($p.IsEditor) {
                    if (Set-ProcessPriority -Target $p -PriorityName 'High') { $success++ } else { $fail++ }
                } elseif ($p.Name -match 'chrome|firefox|edge|brave|opera|steam|discord|spotify|launcher') {
                    if (Set-ProcessPriority -Target $p -PriorityName 'BelowNormal') { $success++ } else { $fail++ }
                } else {
                    if (Set-ProcessPriority -Target $p -PriorityName 'Normal') { $success++ } else { $fail++ }
                }
            }
            Log-Action "Applied Export/Render Mode: $success changed; $fail could not be changed."
            Show-BalloonTip 'QuadraHydra' 'Export/Render Mode active. Editor at High priority.' 'Warning'
        }
    }

    Update-ProfileLabel
    Refresh-Grid
}

# =============================================================================
#  FORM SETUP
# =============================================================================
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

# Global exception handlers â€” prevent silent crashes
[System.Windows.Forms.Application]::add_ThreadException({
    try {
        $ex = $_.Exception
        [System.Windows.Forms.MessageBox]::Show(
            "An error occurred in QuadraHydra(TM):`n`n$($ex.Message)`n`nStack Trace:`n$($ex.StackTrace)",
            'QuadraHydra Error', 'OK', 'Error') | Out-Null
    } catch { }
})
[System.AppDomain]::CurrentDomain::add_UnhandledException({
    try {
        $ex = $_.ExceptionObject
        if ($ex -is [System.Exception]) {
            [System.Windows.Forms.MessageBox]::Show(
                "A fatal error occurred in QuadraHydra(TM):`n`n$($ex.Message)`n`nStack Trace:`n$($ex.StackTrace)",
                'QuadraHydra Fatal Error', 'OK', 'Error') | Out-Null
        }
    } catch { }
})

$form = New-Object System.Windows.Forms.Form
$form.Text = "$script:AppName v$script:AppVersion  |  $script:CompanyName"
$form.Size = New-Object System.Drawing.Size(1200, 800)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [System.Drawing.Color]::FromArgb(30, 30, 40)
$form.ForeColor = [System.Drawing.Color]::FromArgb(220, 220, 230)
$form.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$form.MinimumSize = New-Object System.Drawing.Size(900, 600)
$form.AutoScroll = $true
$form.AutoScrollMinSize = New-Object System.Drawing.Size(1200, 770)
if ($script:WindowX -and $script:WindowY) { $form.Location = New-Object System.Drawing.Point($script:WindowX, $script:WindowY) }
if ($script:WindowW -and $script:WindowH) { $form.Size = New-Object System.Drawing.Size($script:WindowW, $script:WindowH) }

# --- Title Bar Label ---
$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = 'QUADRAHYDRA(TM) COMMAND CENTER'
$titleLabel.Font = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
$titleLabel.ForeColor = [System.Drawing.Color]::FromArgb(0, 180, 220)
$titleLabel.AutoSize = $true
$titleLabel.Location = New-Object System.Drawing.Point(20, 15)
$form.Controls.Add($titleLabel)

$subTitle = New-Object System.Windows.Forms.Label
$subTitle.Text = "Resource Priority Manager  |  $script:CompanyName  |  Build $script:BuildID"
$subTitle.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Italic)
$subTitle.ForeColor = [System.Drawing.Color]::FromArgb(150, 150, 160)
$subTitle.AutoSize = $true
$subTitle.Location = New-Object System.Drawing.Point(22, 45)
$form.Controls.Add($subTitle)

# --- Admin Status & Button ---
$adminLabel = New-Object System.Windows.Forms.Label
$adminLabel.AutoSize = $true
$adminLabel.Location = New-Object System.Drawing.Point(880, 25)
$adminLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($adminLabel)

$btnAdmin = New-Object System.Windows.Forms.Button
$btnAdmin.Size = New-Object System.Drawing.Size(180, 32)
$btnAdmin.Location = New-Object System.Drawing.Point(860, 48)
$btnAdmin.FlatStyle = 'Flat'
$btnAdmin.BackColor = [System.Drawing.Color]::FromArgb(60, 60, 80)
$btnAdmin.ForeColor = [System.Drawing.Color]::White
$btnAdmin.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($btnAdmin)

function Update-AdminUI {
    if ($script:AdminMode) {
        $adminLabel.Text = 'ADMIN POWERS: ACTIVE'
        $adminLabel.ForeColor = [System.Drawing.Color]::FromArgb(0, 220, 100)
        $btnAdmin.Text = 'Admin Active'
        $btnAdmin.BackColor = [System.Drawing.Color]::FromArgb(0, 120, 60)
        $btnAdmin.Enabled = $false
    } else {
        $adminLabel.Text = 'ADMIN POWERS: INACTIVE'
        $adminLabel.ForeColor = [System.Drawing.Color]::FromArgb(220, 80, 60)
        $btnAdmin.Text = 'Activate Admin Powers'
        $btnAdmin.BackColor = [System.Drawing.Color]::FromArgb(180, 60, 40)
        $btnAdmin.Enabled = $true
    }
}

function Show-AdminInputDialog {
    $dlg = New-Object System.Windows.Forms.Form
    $dlg.Text = 'Admin Activation Verification'
    $dlg.Size = New-Object System.Drawing.Size(420, 200)
    $dlg.StartPosition = 'CenterParent'
    $dlg.FormBorderStyle = 'FixedDialog'
    $dlg.MaximizeBox = $false
    $dlg.MinimizeBox = $false
    $dlg.BackColor = [System.Drawing.Color]::FromArgb(30, 30, 40)
    $dlg.ForeColor = [System.Drawing.Color]::FromArgb(220, 220, 230)
    $dlg.Font = $form.Font

    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = "Type 'admin' (any case) to activate Admin Powers:`n`nThis will restart QuadraHydra with elevated privileges."
    $lbl.Location = New-Object System.Drawing.Point(15, 15)
    $lbl.Size = New-Object System.Drawing.Size(380, 40)
    $dlg.Controls.Add($lbl)

    $txt = New-Object System.Windows.Forms.TextBox
    $txt.Location = New-Object System.Drawing.Point(15, 65)
    $txt.Size = New-Object System.Drawing.Size(370, 22)
    $txt.BackColor = [System.Drawing.Color]::FromArgb(50, 50, 65)
    $txt.ForeColor = [System.Drawing.Color]::White
    $txt.BorderStyle = 'FixedSingle'
    $dlg.Controls.Add($txt)

    $btnOK = New-Object System.Windows.Forms.Button
    $btnOK.Text = 'Activate'
    $btnOK.Location = New-Object System.Drawing.Point(310, 105)
    $btnOK.Size = New-Object System.Drawing.Size(75, 28)
    $btnOK.FlatStyle = 'Flat'
    $btnOK.BackColor = [System.Drawing.Color]::FromArgb(180, 60, 40)
    $btnOK.ForeColor = [System.Drawing.Color]::White
    $btnOK.DialogResult = 'OK'
    $dlg.Controls.Add($btnOK)
    $dlg.AcceptButton = $btnOK

    $btnCancel = New-Object System.Windows.Forms.Button
    $btnCancel.Text = 'Cancel'
    $btnCancel.Location = New-Object System.Drawing.Point(220, 105)
    $btnCancel.Size = New-Object System.Drawing.Size(75, 28)
    $btnCancel.FlatStyle = 'Flat'
    $btnCancel.BackColor = [System.Drawing.Color]::FromArgb(80, 80, 90)
    $btnCancel.ForeColor = [System.Drawing.Color]::White
    $btnCancel.DialogResult = 'Cancel'
    $dlg.Controls.Add($btnCancel)
    $dlg.CancelButton = $btnCancel

    $dlg.ActiveControl = $txt
    $result = $dlg.ShowDialog($form)
    $entered = $txt.Text.Trim()
    $dlg.Dispose()

    if ($result -eq 'OK' -and $entered -ieq 'admin') {
        return $true
    }
    return $false
}

$btnAdmin.Add_Click({
    $r1 = [System.Windows.Forms.MessageBox]::Show(
        "Activating Admin Powers allows QuadraHydra to change priority on protected and system-level processes.`n`nThis can be dangerous and may cause system instability if misused.`n`nAre you SURE you wish to proceed?",
        'WARNING: Administrative Activation',
        'YesNo',
        'Warning'
    )
    if ($r1 -ne 'Yes') { return }

    $ok = Show-AdminInputDialog
    if ($ok) {
        Log-Action 'User initiated Admin Power activation.'
        Restart-Elevated
    } else {
        Log-Action 'Admin Power activation cancelled at text verification.'
    }
})

# --- Top Stats Panel ---
$statsPanel = New-Object System.Windows.Forms.Panel
$statsPanel.Location = New-Object System.Drawing.Point(20, 80)
$statsPanel.Size = New-Object System.Drawing.Size(1160, 90)
$statsPanel.BackColor = [System.Drawing.Color]::FromArgb(40, 40, 55)
$statsPanel.BorderStyle = 'None'
$form.Controls.Add($statsPanel)

function New-StatLabel([string]$Text, [int]$X, [int]$Y, [int]$W=100, [switch]$IsValue) {
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = $Text
    $lbl.Location = New-Object System.Drawing.Point($X, $Y)
    $lbl.Size = New-Object System.Drawing.Size($W, 22)
    $lbl.Font = if ($IsValue) { New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold) } else { $form.Font }
    $lbl.ForeColor = if ($IsValue) { [System.Drawing.Color]::White } else { [System.Drawing.Color]::FromArgb(180, 180, 190) }
    $lbl
}

function New-ProgressBar([int]$X, [int]$Y, [int]$W, [int]$H, [System.Drawing.Color]$Color) {
    $pb = New-Object System.Windows.Forms.ProgressBar
    $pb.Location = New-Object System.Drawing.Point($X, $Y)
    $pb.Size = New-Object System.Drawing.Size($W, $H)
    $pb.Style = 'Continuous'
    $pb.Value = 0
    # Owner-draw-like color via backcolor hack in modern themes is limited; we use ForeColor where possible
    $pb.ForeColor = $Color
    $pb.BackColor = [System.Drawing.Color]::FromArgb(25, 25, 35)
    $pb
}

$statsPanel.Controls.Add((New-StatLabel 'CPU Usage' 15 5 90))
$statCpuVal = New-StatLabel '0%' 15 25 90 -IsValue
$statsPanel.Controls.Add($statCpuVal)
$barCpu = New-ProgressBar 15 50 200 12 ([System.Drawing.Color]::FromArgb(0, 180, 220))
$statsPanel.Controls.Add($barCpu)

$statsPanel.Controls.Add((New-StatLabel 'RAM Usage' 250 5 120))
$statRamVal = New-StatLabel '0 GB / 0 GB' 250 25 140 -IsValue
$statsPanel.Controls.Add($statRamVal)
$barRam = New-ProgressBar 250 50 200 12 ([System.Drawing.Color]::FromArgb(0, 220, 100))
$statsPanel.Controls.Add($barRam)

$statsPanel.Controls.Add((New-StatLabel 'GPU Dedicated' 485 5 140))
$statGpuVal = New-StatLabel 'N/A' 485 25 180 -IsValue
$statsPanel.Controls.Add($statGpuVal)
$statsPanel.Controls.Add((New-StatLabel 'GPU Shared' 685 5 140))
$statGpuShared = New-StatLabel 'N/A' 685 25 180 -IsValue
$statsPanel.Controls.Add($statGpuShared)

$statsPanel.Controls.Add((New-StatLabel 'Active Profile' 920 5 200))
$lblProfile = New-StatLabel 'Normal Mode' 920 25 200 -IsValue
$lblProfile.ForeColor = [System.Drawing.Color]::FromArgb(0, 220, 100)
$statsPanel.Controls.Add($lblProfile)

$statsPanel.Controls.Add((New-StatLabel 'Logical Threads' 920 50 200))
$lblThreads = New-StatLabel "$([Environment]::ProcessorCount) Threads Available" 920 68 200
$lblThreads.ForeColor = [System.Drawing.Color]::FromArgb(180, 180, 190)
$statsPanel.Controls.Add($lblThreads)

# --- Process List (Grid) ---
$gridPanel = New-Object System.Windows.Forms.Panel
$gridPanel.Location = New-Object System.Drawing.Point(20, 185)
$gridPanel.Size = New-Object System.Drawing.Size(820, 470)
$gridPanel.BackColor = [System.Drawing.Color]::FromArgb(35, 35, 48)
$gridPanel.BorderStyle = 'FixedSingle'
$form.Controls.Add($gridPanel)

$gridLabel = New-Object System.Windows.Forms.Label
$gridLabel.Text = 'RUNNING PROCESSES'
$gridLabel.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$gridLabel.ForeColor = [System.Drawing.Color]::FromArgb(200, 200, 210)
$gridLabel.Location = New-Object System.Drawing.Point(5, 5)
$gridLabel.AutoSize = $true
$gridPanel.Controls.Add($gridLabel)

# Search box
$txtSearch = New-Object System.Windows.Forms.TextBox
$txtSearch.Location = New-Object System.Drawing.Point(600, 3)
$txtSearch.Size = New-Object System.Drawing.Size(200, 22)
$txtSearch.BackColor = [System.Drawing.Color]::FromArgb(50, 50, 65)
$txtSearch.ForeColor = [System.Drawing.Color]::White
$txtSearch.BorderStyle = 'FixedSingle'
$txtSearch.Font = $form.Font
$txtSearch.Add_TextChanged({ Filter-Grid })
$gridPanel.Controls.Add($txtSearch)
$gridPanel.Controls.Add((New-StatLabel 'Search:' 550 5 50))

# Process count label
$lblProcCount = New-Object System.Windows.Forms.Label
$lblProcCount.Text = '0 processes'
$lblProcCount.Location = New-Object System.Drawing.Point(5, 465)
$lblProcCount.AutoSize = $true
$lblProcCount.ForeColor = [System.Drawing.Color]::FromArgb(150, 150, 160)
$lblProcCount.Font = New-Object System.Drawing.Font('Segoe UI', 8.5)
$gridPanel.Controls.Add($lblProcCount)

$listView = New-Object System.Windows.Forms.ListView
$listView.Location = New-Object System.Drawing.Point(5, 30)
$listView.Size = New-Object System.Drawing.Size(808, 430)
$listView.View = 'Details'
$listView.FullRowSelect = $true
$listView.MultiSelect = $false
$listView.GridLines = $true
$listView.BackColor = [System.Drawing.Color]::FromArgb(30, 30, 42)
$listView.ForeColor = [System.Drawing.Color]::FromArgb(220, 220, 230)
$listView.Font = New-Object System.Drawing.Font('Consolas', 9)
$listView.BorderStyle = 'None'
$listView.HideSelection = $false
$listView.Add_MouseDown({
    $timer.Stop()
    if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Right) {
        $hit = $listView.HitTest($_.Location)
        foreach ($selected in @($listView.SelectedItems)) { $selected.Selected = $false }
        if ($hit.Item) { $hit.Item.Selected = $true; $hit.Item.Focused = $true }
    }
})
$listView.Add_MouseUp({ if (-not $ctxMenu.Visible) { $timer.Start() } })
$listView.Add_MouseDoubleClick({
    if ($listView.SelectedItems.Count -gt 0) {
        $procId = [int]$listView.SelectedItems[0].SubItems[1].Text
        $path = Get-ProcessPath -ProcId $procId
        if ($path) {
            $folder = Split-Path $path -Parent
            if (Test-Path $folder) {
                Start-Process explorer.exe -ArgumentList $folder
            }
        } else {
            [System.Windows.Forms.MessageBox]::Show('Could not determine file location for this process. It may require Admin Powers.', 'No Path Available', 'OK', 'Information') | Out-Null
        }
    }
})
$listView.Columns.Add('Process Name', 200) | Out-Null
$listView.Columns.Add('PID', 60) | Out-Null
$listView.Columns.Add('CPU %', 70) | Out-Null
$listView.Columns.Add('RAM', 90) | Out-Null
$listView.Columns.Add('Priority', 110) | Out-Null
$listView.Columns.Add('Status', 120) | Out-Null
$listView.Columns.Add('Action', 140) | Out-Null
$gridPanel.Controls.Add($listView)

# --- Right Control Panel ---
$ctrlPanel = New-Object System.Windows.Forms.Panel
$ctrlPanel.Location = New-Object System.Drawing.Point(860, 185)
$ctrlPanel.Size = New-Object System.Drawing.Size(320, 470)
$ctrlPanel.BackColor = [System.Drawing.Color]::FromArgb(40, 40, 55)
$ctrlPanel.BorderStyle = 'FixedSingle'
$form.Controls.Add($ctrlPanel)

$ctrlTitle = New-Object System.Windows.Forms.Label
$ctrlTitle.Text = 'CONTROLS'
$ctrlTitle.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
$ctrlTitle.ForeColor = [System.Drawing.Color]::FromArgb(0, 180, 220)
$ctrlTitle.Location = New-Object System.Drawing.Point(10, 8)
$ctrlTitle.AutoSize = $true
$ctrlPanel.Controls.Add($ctrlTitle)

# Profile Buttons
$yOff = 40
$profiles = @(
    @{ Name='Normal Mode';        Color=[System.Drawing.Color]::FromArgb(80,80,90);  TextColor=[System.Drawing.Color]::White; Tip='Reset all safe processes to Normal priority.' },
    @{ Name='Video Editing Mode'; Color=[System.Drawing.Color]::FromArgb(0,100,140);  TextColor=[System.Drawing.Color]::White; Tip='Favor video editors (AboveNormal), restrain browsers (BelowNormal).' },
    @{ Name='Export / Render Mode'; Color=[System.Drawing.Color]::FromArgb(180,80,30); TextColor=[System.Drawing.Color]::White; Tip='Editor to HIGH. Background to BelowNormal. Use only during export/render.' }
)

foreach ($prof in $profiles) {
    $btn = New-Object System.Windows.Forms.Button
    $btn.Text = $prof.Name
    $btn.Size = New-Object System.Drawing.Size(300, 40)
    $btn.Location = New-Object System.Drawing.Point(10, $yOff)
    $btn.FlatStyle = 'Flat'
    $btn.BackColor = $prof.Color
    $btn.ForeColor = $prof.TextColor
    $btn.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
    $btn.Tag = $prof.Name
    $tt = New-Object System.Windows.Forms.ToolTip
    $tt.SetToolTip($btn, $prof.Tip)
    $btn.Add_Click({ Apply-Profile $this.Tag })
    $ctrlPanel.Controls.Add($btn)
    $yOff += 50
}

$yOff += 10

# Selected Process Priority Buttons
$lblSel = New-Object System.Windows.Forms.Label
$lblSel.Text = 'Selected Process Priority:'
$lblSel.ForeColor = [System.Drawing.Color]::FromArgb(180, 180, 190)
$lblSel.Location = New-Object System.Drawing.Point(10, $yOff)
$lblSel.AutoSize = $true
$ctrlPanel.Controls.Add($lblSel)
$yOff += 25

$prioButtons = @(
    @{ Text='Resting (Idle)';         Prio='Idle';         Color=[System.Drawing.Color]::FromArgb(100,100,110); Tip='Lowest priority. Good for background updaters.' },
    @{ Text='Restrained (BelowNormal)'; Prio='BelowNormal'; Color=[System.Drawing.Color]::FromArgb(60,80,120); Tip='Lower than default. Browsers/helpers while editing.' },
    @{ Text='Balanced (Normal)';        Prio='Normal';        Color=[System.Drawing.Color]::FromArgb(60,120,60); Tip='Standard Windows priority.' },
    @{ Text='Favored (AboveNormal)';    Prio='AboveNormal';   Color=[System.Drawing.Color]::FromArgb(160,120,0); Tip='Safer boost for active creative work.' },
    @{ Text='Maximum Work (High)';      Prio='High';          Color=[System.Drawing.Color]::FromArgb(180,50,40); Tip='Export/render only. System may be less responsive.' }
)

foreach ($pb in $prioButtons) {
    $btn = New-Object System.Windows.Forms.Button
    $btn.Text = $pb.Text
    $btn.Size = New-Object System.Drawing.Size(300, 30)
    $btn.Location = New-Object System.Drawing.Point(10, $yOff)
    $btn.FlatStyle = 'Flat'
    $btn.BackColor = $pb.Color
    $btn.ForeColor = [System.Drawing.Color]::White
    $btn.Font = New-Object System.Drawing.Font('Segoe UI', 9)
    $btn.Tag = $pb.Prio
    $tt = New-Object System.Windows.Forms.ToolTip
    $tt.SetToolTip($btn, $pb.Tip)
    $btn.Add_Click({ Invoke-SelectedPriority -PriorityName $this.Tag })
    $ctrlPanel.Controls.Add($btn)
    $yOff += 35
}

# About button
$yOff += 10
$btnAbout = New-Object System.Windows.Forms.Button
$btnAbout.Text = 'About / Terms'
$btnAbout.Size = New-Object System.Drawing.Size(145, 30)
$btnAbout.Location = New-Object System.Drawing.Point(10, $yOff)
$btnAbout.FlatStyle = 'Flat'
$btnAbout.BackColor = [System.Drawing.Color]::FromArgb(50, 50, 70)
$btnAbout.ForeColor = [System.Drawing.Color]::White
$btnAbout.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$btnAbout.Add_Click({ Show-AboutDialog })
$ctrlPanel.Controls.Add($btnAbout)

# Check for Updates button
$btnUpdate = New-Object System.Windows.Forms.Button
$btnUpdate.Text = 'Check for Updates'
$btnUpdate.Size = New-Object System.Drawing.Size(145, 30)
$btnUpdate.Location = New-Object System.Drawing.Point(165, $yOff)
$btnUpdate.FlatStyle = 'Flat'
$btnUpdate.BackColor = [System.Drawing.Color]::FromArgb(40, 60, 80)
$btnUpdate.ForeColor = [System.Drawing.Color]::White
$btnUpdate.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$btnUpdate.Add_Click({ [void](Check-ForUpdates -Silent $false) })
$ctrlPanel.Controls.Add($btnUpdate)

# --- Bottom Log Panel ---
$logPanel = New-Object System.Windows.Forms.Panel
$logPanel.Location = New-Object System.Drawing.Point(20, 665)
$logPanel.Size = New-Object System.Drawing.Size(1160, 90)
$logPanel.BackColor = [System.Drawing.Color]::FromArgb(30, 30, 40)
$logPanel.BorderStyle = 'FixedSingle'
$form.Controls.Add($logPanel)

$logLabel = New-Object System.Windows.Forms.Label
$logLabel.Text = 'ACTIVITY LOG'
$logLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
$logLabel.ForeColor = [System.Drawing.Color]::FromArgb(150, 150, 160)
$logLabel.Location = New-Object System.Drawing.Point(5, 3)
$logLabel.AutoSize = $true
$logPanel.Controls.Add($logLabel)

$logBox = New-Object System.Windows.Forms.ListBox
$logBox.Location = New-Object System.Drawing.Point(5, 20)
$logBox.Size = New-Object System.Drawing.Size(1148, 65)
$logBox.BackColor = [System.Drawing.Color]::FromArgb(25, 25, 35)
$logBox.ForeColor = [System.Drawing.Color]::FromArgb(200, 200, 200)
$logBox.Font = New-Object System.Drawing.Font('Consolas', 8.5)
$logBox.BorderStyle = 'None'
$logBox.HorizontalScrollbar = $true
$logPanel.Controls.Add($logBox)
$script:logBox = $logBox

# --- Status Strip ---
$status = New-Object System.Windows.Forms.StatusStrip
$status.BackColor = [System.Drawing.Color]::FromArgb(25, 25, 35)
$status.ForeColor = [System.Drawing.Color]::FromArgb(180, 180, 190)
$statusLabel = New-Object System.Windows.Forms.ToolStripStatusLabel
$statusLabel.Text = 'Ready'
[void]$status.Items.Add($statusLabel)
$form.Controls.Add($status)
$script:statusLabel = $statusLabel

# --- Context Menu for Process List ---
$ctxMenu = New-Object System.Windows.Forms.ContextMenuStrip
$ctxMenu.BackColor = [System.Drawing.Color]::FromArgb(45, 45, 60)
$ctxMenu.ForeColor = [System.Drawing.Color]::White
$ctxMenu.Add_Opening({ $timer.Stop() })
$ctxMenu.Add_Closed({ $timer.Start() })
$ctxMenu.Renderer = New-Object System.Windows.Forms.ToolStripProfessionalRenderer(New-Object System.Windows.Forms.ProfessionalColorTable)

$ctxFavor = New-Object System.Windows.Forms.ToolStripMenuItem('Favor (AboveNormal)')
$ctxFavor.Add_Click({ Invoke-SelectedPriority -PriorityName 'AboveNormal' })
$ctxRestrain = New-Object System.Windows.Forms.ToolStripMenuItem('Restrain (BelowNormal)')
$ctxRestrain.Add_Click({ Invoke-SelectedPriority -PriorityName 'BelowNormal' })
$ctxNormal = New-Object System.Windows.Forms.ToolStripMenuItem('Balance (Normal)')
$ctxNormal.Add_Click({ Invoke-SelectedPriority -PriorityName 'Normal' })
$ctxKill = New-Object System.Windows.Forms.ToolStripMenuItem('End Process')
$ctxKill.ForeColor = [System.Drawing.Color]::FromArgb(220, 80, 60)
$ctxKill.Add_Click({
    if ($listView.SelectedItems.Count -gt 0) {
        $target = $listView.SelectedItems[0].Tag
        $timer.Stop()
        try {
            $proc = Resolve-TargetProcess $target
            $r = [System.Windows.Forms.MessageBox]::Show($form, "End '$($target.Name)' (PID $($target.Id))? Unsaved work in that process may be lost.", 'Confirm Termination', 'YesNo', 'Exclamation')
            if ($r -ne 'Yes') { return }
            $proc = Resolve-TargetProcess $target
            Stop-Process -InputObject $proc -Force -ErrorAction Stop
            Log-Action "Terminated $($target.Name) (PID $($target.Id))."
            Refresh-Grid
        } catch { Report-ActionError 'End process' $_.Exception.Message }
        finally { $timer.Start() }
    }
})

$ctxSuspend = New-Object System.Windows.Forms.ToolStripMenuItem('Suspend Process')
$ctxSuspend.Add_Click({
    if ($listView.SelectedItems.Count -gt 0) {
        $target = $listView.SelectedItems[0].Tag
        try {
            $proc = Resolve-TargetProcess $target
            if (-not (Suspend-Process -ProcId $proc.Id)) {
                throw 'Not all threads could be suspended. Some may have changed; use Resume if needed.'
            }
            Log-Action "Suspended $($target.Name) (PID $($target.Id))."
            Refresh-Grid
        } catch { Report-ActionError 'Suspend process' $_.Exception.Message }
    }
})

$ctxResume = New-Object System.Windows.Forms.ToolStripMenuItem('Resume Process')
$ctxResume.Add_Click({
    if ($listView.SelectedItems.Count -gt 0) {
        $target = $listView.SelectedItems[0].Tag
        try {
            # A user must still be able to undo a suspension after trial expiry.
            $proc = Resolve-TargetProcess $target -AllowRecovery
            if (-not (Resume-Process -ProcId $proc.Id)) { throw 'Not all threads could be resumed.' }
            Log-Action "Sent resume to $($target.Name) (PID $($target.Id))."
            Refresh-Grid
        } catch { Report-ActionError 'Resume process' $_.Exception.Message }
    }
})

$ctxOpenLocation = New-Object System.Windows.Forms.ToolStripMenuItem('Open File Location')
$ctxOpenLocation.Add_Click({
    if ($listView.SelectedItems.Count -gt 0) {
        $procId = [int]$listView.SelectedItems[0].SubItems[1].Text
        $path = Get-ProcessPath -ProcId $procId
        if ($path) {
            $folder = Split-Path $path -Parent
            if (Test-Path $folder) { Start-Process explorer.exe -ArgumentList $folder }
        } else {
            [System.Windows.Forms.MessageBox]::Show('Could not determine file location. May require Admin Powers.', 'No Path', 'OK', 'Information') | Out-Null
        }
    }
})

[void]$ctxMenu.Items.Add($ctxFavor)
[void]$ctxMenu.Items.Add($ctxRestrain)
[void]$ctxMenu.Items.Add($ctxNormal)
[void]$ctxMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
[void]$ctxMenu.Items.Add($ctxSuspend)
[void]$ctxMenu.Items.Add($ctxResume)
[void]$ctxMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
[void]$ctxMenu.Items.Add($ctxOpenLocation)
[void]$ctxMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
[void]$ctxMenu.Items.Add($ctxKill)
$listView.ContextMenuStrip = $ctxMenu

# =============================================================================
#  REFRESH & UPDATE LOGIC
# =============================================================================
function Update-ProfileLabel {
    $lblProfile.Text = $script:CurrentProfile
    switch ($script:CurrentProfile) {
        'Normal Mode'          { $lblProfile.ForeColor = [System.Drawing.Color]::FromArgb(0, 220, 100) }
        'Video Editing Mode'   { $lblProfile.ForeColor = [System.Drawing.Color]::FromArgb(0, 180, 220) }
        'Export / Render Mode' { $lblProfile.ForeColor = [System.Drawing.Color]::FromArgb(220, 180, 0) }
    }
}

function Refresh-Grid {
    # Fetch fresh process data and cache it
    $script:CachedProcs = Get-ProcessData | Sort-Object -Property @{Expression={ if ($_.IsEditor) {0} elseif ($_.IsProtected) {2} else {1} } }, @{Expression='Cpu'; Descending=$true}
    Filter-Grid
}

function Filter-Grid {
    # Use cached data â€” no re-query needed for search filtering
    $search = $txtSearch.Text.ToLower()
    $procs = @($script:CachedProcs | Where-Object {
        if ($search) { $_.Name -like "*$search*" -or [string]$_.Id -like "*$search*" } else { $true }
    })

    $selectedTarget = if ($listView.SelectedItems.Count -eq 1) { $listView.SelectedItems[0].Tag } else { $null }
    $topId = if ($listView.TopItem) { $listView.TopItem.Tag.Id } else { -1 }
    $newTop = $null

    $listView.BeginUpdate()
    try {
    $listView.Items.Clear()
    foreach ($p in $procs) {
        $status = if ($p.IsProtected) { 'PROTECTED' } elseif ($p.IsEditor) { 'VIDEO EDITOR' } else { 'Normal' }
        $action = switch ($p.Priority) {
            'Idle'         { 'Resting' }
            'BelowNormal'  { 'Restrained' }
            'Normal'       { 'Balanced' }
            'AboveNormal'  { 'Favored' }
            'High'         { 'Maximum Work' }
            default        { $_ }
        }
        $item = New-Object System.Windows.Forms.ListViewItem($p.Name)
        $item.Tag = $p
        [void]$item.SubItems.Add([string]$p.Id)
        [void]$item.SubItems.Add("$($p.Cpu)%")
        [void]$item.SubItems.Add($p.RamStr)
        [void]$item.SubItems.Add($p.Priority)
        [void]$item.SubItems.Add($status)
        [void]$item.SubItems.Add($action)

        # Color logic based on CPU usage
        if ($p.Cpu -gt 80) {
            $item.BackColor = [System.Drawing.Color]::FromArgb(20, 5, 5)
            $item.ForeColor = [System.Drawing.Color]::FromArgb(255, 40, 40)
        } elseif ($p.Cpu -gt 50) {
            $item.BackColor = [System.Drawing.Color]::FromArgb(90, 10, 10)
            $item.ForeColor = [System.Drawing.Color]::FromArgb(255, 200, 200)
        } elseif ($p.Cpu -gt 20) {
            $item.BackColor = [System.Drawing.Color]::FromArgb(70, 20, 20)
            $item.ForeColor = [System.Drawing.Color]::FromArgb(255, 120, 80)
        } elseif ($p.Cpu -gt 5) {
            $item.BackColor = [System.Drawing.Color]::FromArgb(55, 50, 15)
            $item.ForeColor = [System.Drawing.Color]::FromArgb(255, 220, 60)
        } else {
            $item.BackColor = [System.Drawing.Color]::FromArgb(20, 45, 20)
            $item.ForeColor = [System.Drawing.Color]::FromArgb(100, 255, 120)
        }
        [void]$listView.Items.Add($item)
        if ($selectedTarget -and $p.Id -eq $selectedTarget.Id -and
            $p.Name -eq $selectedTarget.Name -and $p.StartTicks -eq $selectedTarget.StartTicks) {
            $item.Selected = $true
            $item.Focused = $true
        }
        if ($p.Id -eq $topId) { $newTop = $item }
    }
    if ($newTop) { $listView.TopItem = $newTop }
    } finally { $listView.EndUpdate() }
    $lblProcCount.Text = "$($procs.Count) processes (of $($script:CachedProcs.Count) total)"
}

function Refresh-Stats {
    $stats = Get-SystemStats
    $barCpu.Value = [math]::Min(100, $stats.CpuPct)
    $statCpuVal.Text = "$($stats.CpuPct)%"

    $barRam.Value = [math]::Min(100, [int]$stats.RamPct)
    $statRamVal.Text = "$(Format-Bytes $stats.RamUsed) / $(Format-Bytes $stats.RamTotal) ($($stats.RamPct)%)"

    $statGpuVal.Text = if ($stats.GpuVram -gt 0) { (Format-Bytes $stats.GpuVram) } else { 'N/A' }
    $statGpuShared.Text = if ($stats.GpuShared -gt 0) { (Format-Bytes $stats.GpuShared) } else { 'N/A' }

    # Detect video editor
    $editorsRunning = Get-Process | Where-Object { $script:VideoEditors -contains $_.ProcessName }
    if ($editorsRunning -and -not $script:VideoEditorDetected) {
        $script:VideoEditorDetected = $true
        Log-Action "Detected video editor: $($editorsRunning[0].ProcessName)"
        Show-BalloonTip 'QuadraHydra' "Video editor detected: $($editorsRunning[0].ProcessName). Consider activating Video Editing Mode." 'Info'
    } elseif (-not $editorsRunning) {
        $script:VideoEditorDetected = $false
    }
}

# --- Timer ---
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000
$timer.Add_Tick({
    try {
        if (-not (Test-SessionAccess)) {
            if (-not $script:TrialExpiryNotified) {
                $script:TrialExpiryNotified = $true
                $timer.Stop()
                Log-Action 'The three-day trial has ended. Purchase-key activation is required.'
                try { [void](Show-LicenseDialog) } finally { $timer.Start() }
            }
            $script:statusLabel.Text = 'Trial ended. Activate a purchase key to continue. Resume remains available to undo suspensions.'
            return
        }
        $script:TrialExpiryNotified = $false
        Refresh-Stats
        Refresh-Grid
        $script:statusLabel.Text = "Last refresh: $(Get-Date -Format 'HH:mm:ss') | Profile: $($script:CurrentProfile) | Admin: $(if($script:AdminMode){'Active'}else{'Inactive'})"
    } catch {
        $script:statusLabel.Text = "Refresh error: $($_.Exception.Message)"
        Log-Action $script:statusLabel.Text
    }
})

# --- Form Events ---
$form.Add_Shown({
    try {
        Update-AdminUI
        Refresh-Stats
        Refresh-Grid
        $timer.Start()
        Log-Action 'QuadraHydra(TM) Command Center started.'
        if ($script:LicenseActivated) {
            Log-Action 'License activated.'
        } elseif ($script:IsTrialMode) {
            Log-Action "Trial mode: $($script:TrialDays) day(s) remaining."
        }
        if ($script:AdminMode) {
            Log-Action 'Admin Powers activated on this session.'
        } else {
            Log-Action 'Running in standard mode. Admin Powers available via button (double confirmation required).'
        }

        if ($AdminActivated) {
            Show-BalloonTip 'QuadraHydra' 'Admin Powers are now active. You can modify protected process priorities.' 'Info'
        }

    } catch {
        Write-Host "Startup error: $($_.Exception.Message)`n$($_.ScriptStackTrace)"
        [System.Windows.Forms.MessageBox]::Show(
            "Startup error in QuadraHydra(TM):`n`n$($_.Exception.Message)`n`n$($_.ScriptStackTrace)",
            'QuadraHydra Startup Error', 'OK', 'Error') | Out-Null
    }

    # Store asynchronous state at script scope so timer callbacks retain it.
    try {
        $script:UpdateJob = Start-Job -ScriptBlock {
            param($Url, $Version)
            try {
                $response = Invoke-RestMethod -Uri $Url -TimeoutSec 10 -ErrorAction Stop
                if ([version]$response.latest_version -gt [version]$Version) { return $response }
            } catch { }
        } -ArgumentList $script:UpdateManifestURL, $script:AppVersion -ErrorAction Stop

        $script:UpdateTimer = New-Object System.Windows.Forms.Timer
        $script:UpdateTimer.Interval = 1000
        $script:UpdateTimer.Add_Tick({
            if (-not $script:UpdateJob) { return }
            if ($script:UpdateJob.State -notin @('Completed','Failed','Stopped')) { return }
            try {
                $result = Receive-Job -Job $script:UpdateJob -ErrorAction SilentlyContinue
                Clear-UpdateJob
                if ($result -and $result.latest_version) {
                    $msg = "A new version of QuadraHydra(TM) is available!`n`nYour version: $script:AppVersion`nLatest version: $($result.latest_version)`n`nOpen the download page?"
                    if ([System.Windows.Forms.MessageBox]::Show($form, $msg, 'Update Available', 'YesNo', 'Information') -eq 'Yes') {
                        $url = if ($result.download_url) { $result.download_url } else { 'https://averylogicworks.com/downloads' }
                        if ([uri]$url -and ([uri]$url).Scheme -eq 'https') { Start-Process $url }
                    }
                    Log-Action "Update available: v$($result.latest_version)"
                }
            } catch { Clear-UpdateJob; Log-Action 'Automatic update check could not complete.' }
        })
        $script:UpdateTimer.Start()
    } catch { Clear-UpdateJob; Log-Action 'Automatic update check could not start. Manual checking is available.' }

})

$form.Add_FormClosing({
    $timer.Stop()
    Clear-UpdateJob
    try { Save-Config }
    catch {
        [System.Windows.Forms.MessageBox]::Show($form, "Settings could not be saved: $($_.Exception.Message)", 'QuadraHydra', 'OK', 'Warning') | Out-Null
    }
    $trayIcon.Visible = $false
    $trayIcon.Dispose()
})

# --- System Tray Icon ---
$trayIcon = New-Object System.Windows.Forms.NotifyIcon
$trayIcon.Icon = [System.Drawing.SystemIcons]::Application
$trayIcon.Text = "$script:AppShortName(TM) - $script:CompanyName"
$trayIcon.Visible = $true
$script:TrayIcon = $trayIcon

$trayMenu = New-Object System.Windows.Forms.ContextMenu
$trayShow = New-Object System.Windows.Forms.MenuItem('Show QuadraHydra')
$trayShow.Add_Click({
    $form.WindowState = 'Normal'
    $form.Show()
    $form.Activate()
})
$trayNormal = New-Object System.Windows.Forms.MenuItem('Normal Mode')
$trayNormal.Add_Click({ Apply-Profile 'Normal Mode' })
$trayVideo = New-Object System.Windows.Forms.MenuItem('Video Editing Mode')
$trayVideo.Add_Click({ Apply-Profile 'Video Editing Mode' })
$trayExport = New-Object System.Windows.Forms.MenuItem('Export / Render Mode')
$trayExport.Add_Click({ Apply-Profile 'Export / Render Mode' })
$traySep = New-Object System.Windows.Forms.MenuItem('-')
$trayUpdate = New-Object System.Windows.Forms.MenuItem('Check for Updates')
$trayUpdate.Add_Click({ [void](Check-ForUpdates -Silent $false) })
$trayLogs = New-Object System.Windows.Forms.MenuItem('Open Diagnostic Logs')
$trayLogs.Add_Click({
    $folder = Join-Path $script:DataPath 'Logs'
    if (Test-Path -LiteralPath $folder) { Start-Process explorer.exe -ArgumentList ('"{0}"' -f $folder) }
})
$trayExit = New-Object System.Windows.Forms.MenuItem('Exit')
$trayExit.Add_Click({
    $trayIcon.Visible = $false
    $form.Close()
})
[void]$trayMenu.MenuItems.Add($trayShow)
[void]$trayMenu.MenuItems.Add($traySep)
[void]$trayMenu.MenuItems.Add($trayNormal)
[void]$trayMenu.MenuItems.Add($trayVideo)
[void]$trayMenu.MenuItems.Add($trayExport)
[void]$trayMenu.MenuItems.Add((New-Object System.Windows.Forms.MenuItem('-')))
[void]$trayMenu.MenuItems.Add($trayUpdate)
[void]$trayMenu.MenuItems.Add($trayLogs)
[void]$trayMenu.MenuItems.Add((New-Object System.Windows.Forms.MenuItem('-')))
[void]$trayMenu.MenuItems.Add($trayExit)
$trayIcon.ContextMenu = $trayMenu

$trayIcon.Add_DoubleClick({
    $form.WindowState = 'Normal'
    $form.Show()
    $form.Activate()
})

$form.Add_Resize({
    if ($form.WindowState -eq 'Minimized') {
        $form.Hide()
        Show-BalloonTip $script:AppShortName 'Minimized to tray. Double-click the icon to restore.' 'Info'
    }
})

# =============================================================================
#  KEYBOARD SHORTCUTS
# =============================================================================
$form.KeyPreview = $true
$form.Add_KeyDown({
    switch ($_.KeyCode) {
        'Delete' { if ($listView.Focused) { $ctxKill.PerformClick(); $_.Handled = $true } }
        'F5' { Refresh-Grid; Refresh-Stats; $_.Handled = $true }
        'F1' {
            [System.Windows.Forms.MessageBox]::Show(
                "QuadraHydra(TM) Command Center Help`n" +
                "Copyright (c) 2026 Avery Logic Works - All Rights Reserved`n" +
                "Build $script:BuildID  |  v$script:AppVersion`n`n" +
                "F5        - Refresh process list now`n" +
                "Ctrl+N    - Apply Normal Mode`n" +
                "Ctrl+V    - Apply Video Editing Mode`n" +
                "Ctrl+E    - Apply Export/Render Mode`n" +
                "Ctrl+R    - Refresh list`n" +
                "Del       - End selected process`n" +
                "Double-click process - Open file location`n" +
                "Right-click process   - Context menu (priority, suspend, kill)`n" +
                "`nProfiles:`n" +
                "Normal Mode          - Reset all safe processes to Normal.`n" +
                "Video Editing Mode   - Favor editor (AboveNormal), restrain browsers (BelowNormal).`n" +
                "Export/Render Mode   - Editor to HIGH. Use only during final export.`n" +
                "`nLicense:`n" +
                "USD 15 one-time for one PC. Activate via license key or start a 3-day trial.`n" +
                "Check About dialog for license status.`n" +
                "`nUpdates:`n" +
                "Automatic check on startup. Manual check via 'Check for Updates' button.`n" +
                "`nMinimize to tray for background monitoring.`n" +
                "`nProtected processes (Explorer, RustDesk, system services) cannot be changed unless Admin Powers are active.",
                'QuadraHydra(TM) Help',
                'OK',
                'Information'
            ) | Out-Null
            $_.Handled = $true
        }
    }
})

$form.Add_KeyDown({
    if ($_.Control) {
        switch ($_.KeyCode) {
            'N' { Apply-Profile 'Normal Mode'; $_.Handled = $true }
            'V' { Apply-Profile 'Video Editing Mode'; $_.Handled = $true }
            'E' { Apply-Profile 'Export / Render Mode'; $_.Handled = $true }
            'R' { Refresh-Grid; Refresh-Stats; $_.Handled = $true }
        }
    }
})

# --- License Gate ---
if (-not $script:LicenseValid) {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $licForm = New-Object System.Windows.Forms.Form
    $licForm.Text = "$script:AppName"
    $licForm.Size = New-Object System.Drawing.Size(1, 1)
    $licForm.StartPosition = 'Manual'
    $licForm.Location = New-Object System.Drawing.Point(-1000, -1000)
    $licForm.ShowInTaskbar = $false
    $licForm.Opacity = 0
    [void]$licForm.Show()
    $ok = Show-LicenseDialog
    $licForm.Close()
    $licForm.Dispose()
    if (-not $ok -and -not $script:IsTrialMode) {
        exit
    }
}

# Run
[System.Windows.Forms.Application]::Run($form)
