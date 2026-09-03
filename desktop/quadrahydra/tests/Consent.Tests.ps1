#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'QuadraHydra-Consent.ps1')
$temp = Join-Path ([IO.Path]::GetTempPath()) ('qh-consent-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path (Join-Path $temp 'legal') -Force | Out-Null
try {
    'Terms' | Set-Content (Join-Path $temp 'legal/TERMS_OF_SERVICE.md')
    'Privacy' | Set-Content (Join-Path $temp 'legal/PRIVACY_POLICY.md')
    $agreement = Get-QuadraHydraAgreement $temp
    $record = Join-Path $temp 'terms-acceptance.json'
    if (Test-QuadraHydraAgreement $record $agreement) { throw 'Consent granted before acceptance.' }
    Save-QuadraHydraAgreement $record $agreement
    if (-not (Test-QuadraHydraAgreement $record $agreement)) { throw 'Acceptance did not persist.' }
    'Revised terms' | Set-Content (Join-Path $temp 'legal/TERMS_OF_SERVICE.md')
    if (Test-QuadraHydraAgreement $record (Get-QuadraHydraAgreement $temp)) { throw 'Changed terms must require new acceptance.' }
    'corrupt' | Set-Content $record
    if (Test-QuadraHydraAgreement $record $agreement) { throw 'Corrupt consent must fail closed.' }
    Remove-Item (Join-Path $temp 'legal/TERMS_OF_SERVICE.md')
    $failed = $false
    try { Get-QuadraHydraAgreement $temp | Out-Null } catch { $failed = $true }
    if (-not $failed) { throw 'Missing terms must stop startup.' }
    if (Test-Path (Join-Path $temp 'trial.dat')) { throw 'Reading/accepting terms started the trial.' }
    Write-Output '6 agreement checks passed: first use, persistence, changed terms, corruption, missing documents, and unstarted trial.'
} finally { Remove-Item $temp -Recurse -Force }
