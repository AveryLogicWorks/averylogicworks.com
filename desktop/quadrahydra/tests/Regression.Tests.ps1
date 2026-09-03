#Requires -Version 5.1
# Loads selected functions from the real application without starting the GUI.
# All priority writes are mocked. No running process is reprioritized or stopped.
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$tokens = $null; $parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $project 'QuadraHydra-ControlPanel.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$functions = @('Format-Bytes','Get-ProcessCpu','Get-ProcessData','Resolve-TargetProcess',
    'Set-ProcessPriority','Filter-Grid','Get-TrialWindow','Test-TrialActive','Test-SessionAccess','Start-Trial','Save-License','Test-LicenseValid','Test-SignedLicense','Clear-UpdateJob')
foreach ($name in $functions) {
    $node = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name }, $true)
    if (-not $node) { throw "Missing production function: $name" }
    . ([scriptblock]::Create($node.Extent.Text))
}
$script:checks = 0
function Assert($Condition, [string]$Label) {
    if (-not $Condition) { throw "FAIL: $Label" }
    $script:checks++
    Write-Output "PASS: $Label"
}
Assert ($parseErrors.Count -eq 0) 'Application syntax'

# Reproduce the old cache bug, then exercise the repaired production routine.
$broken = @{ 1 = 1; 2 = 2; 3 = 3 }
$reproduced = $false
try { $broken.Keys | Where-Object { $_ -ne 2 } | ForEach-Object { $broken.Remove($_) } }
catch { $reproduced = $true }
Assert $reproduced 'Original collection-modified failure reproduced'
$script:PrevCpuTimes = @{ -11 = [timespan]::Zero; -12 = [timespan]::Zero }
$script:PrevSnapTime = $null
$script:ProtectedProcesses = @('ProtectedExample')
$script:VideoEditors = @()
$snapshot = @(Get-ProcessData)
Assert ($snapshot.Count -gt 0 -and -not $script:PrevCpuTimes.ContainsKey(-11) -and -not $script:PrevCpuTimes.ContainsKey(-12)) 'Dead-process cache removal succeeds'

# Simulate Windows process objects. Getter/setter checks use actual production code.
$script:AdminMode = $false
$script:LicenseActivated = $true
$script:denyWrite = $false
$script:refreshCount = 0
$script:storedPriority = [System.Diagnostics.ProcessPriorityClass]::Normal
$script:fakeProcess = [pscustomobject]@{ Id = 424242; ProcessName = 'ChatGPT'; StartTime = [datetime]'2026-09-02T10:00:00Z' }
$script:fakeProcess | Add-Member ScriptMethod Refresh { $script:refreshCount++ }
$script:fakeProcess | Add-Member ScriptProperty PriorityClass { $script:storedPriority } {
    param($value)
    if ($script:denyWrite) { throw 'Access denied (simulated)' }
    $script:storedPriority = $value
}
function Get-Process {
    param([int]$Id, $ErrorAction)
    if ($Id -ne $script:fakeProcess.Id) { throw 'Process no longer exists (simulated)' }
    return $script:fakeProcess
}
$target = [pscustomobject]@{ Id = 424242; Name = 'ChatGPT'; StartTicks = $script:fakeProcess.StartTime.ToUniversalTime().Ticks }
Assert (Set-ProcessPriority $target 'High') 'Selected ChatGPT target accepts High'
Assert ($script:storedPriority -eq 'High' -and $script:refreshCount -eq 1) 'Priority is verified after the write'
$script:fakeProcess.ProcessName = 'powershell'
Assert (-not (Set-ProcessPriority $target 'AboveNormal')) 'Reused PID with another process name is rejected'
$script:fakeProcess.ProcessName = 'ChatGPT'
$script:fakeProcess.StartTime = $script:fakeProcess.StartTime.AddSeconds(1)
Assert (-not (Set-ProcessPriority $target 'High')) 'Same name with a different start time is rejected'
$script:fakeProcess.StartTime = $script:fakeProcess.StartTime.AddSeconds(-1)
$script:denyWrite = $true
Assert (-not (Set-ProcessPriority $target 'Normal') -and $script:LastProcessError -match 'Access denied') 'Access denial reports failure'
$script:denyWrite = $false
Assert (-not (Set-ProcessPriority $target 'RealTime')) 'Unsupported realtime priority is rejected'
$self = [pscustomobject]@{ Id = $PID; Name = 'powershell'; StartTicks = 1 }
Assert (-not (Set-ProcessPriority $self 'High')) 'Self-priority changes are rejected'
$script:ProtectedProcesses = @('ChatGPT')
Assert (-not (Set-ProcessPriority $target 'High')) 'Protected process requires explicit admin mode'
$script:AdminMode = $true
Assert (Set-ProcessPriority $target 'AboveNormal') 'Explicit admin mode allows a protected priority change'
$blocked = $false
try { Resolve-TargetProcess $target | Out-Null } catch { $blocked = $true }
Assert $blocked 'Destructive actions still reject protected processes'
$script:LicenseActivated = $false
$script:TrialPath = Join-Path ([IO.Path]::GetTempPath()) ('absent-qh-trial-' + [guid]::NewGuid())
$script:ProtectedProcesses = @()
Assert (-not (Set-ProcessPriority $target 'High')) 'Expired access prevents process modifications'
Assert ((Resolve-TargetProcess $target -AllowRecovery).Id -eq $target.Id) 'Recovery remains available to resume a process after expiry'
$script:fakeProcess.ProcessName = 'DifferentProcess'
$blocked = $false
try { Resolve-TargetProcess $target -AllowRecovery | Out-Null } catch { $blocked = $true }
Assert $blocked 'Recovery still rejects reused process identities'
$script:LicenseActivated = $true
Remove-Item Function:Get-Process

# Exercise the real grid function with a minimal UI model on non-Windows hosts.
Add-Type -AssemblyName System.Drawing
if (-not ('System.Windows.Forms.ListViewItem' -as [type])) {
    Add-Type @'
namespace System.Windows.Forms {
    public class ListViewItem {
        public ListViewItem(string name) { Text = name; }
        public string Text;
        public object Tag;
        public bool Selected;
        public bool Focused;
        public object BackColor;
        public object ForeColor;
        public System.Collections.Generic.List<string> SubItems = new System.Collections.Generic.List<string>();
    }
}
'@
}
$listView = [pscustomobject]@{ Items = [System.Collections.ArrayList]::new(); TopItem = $null; Updating = $false }
$listView | Add-Member ScriptProperty SelectedItems { @($this.Items | Where-Object Selected) }
$listView | Add-Member ScriptMethod BeginUpdate { $this.Updating = $true }
$listView | Add-Member ScriptMethod EndUpdate { $this.Updating = $false }
$txtSearch = [pscustomobject]@{ Text = '' }
$lblProcCount = [pscustomobject]@{ Text = '' }
$chat = [pscustomobject]@{ Id=100; Name='ChatGPT'; StartTicks=1L; Priority='Normal'; Cpu=0; RamStr='10 MB'; IsProtected=$false; IsEditor=$false }
$shell = [pscustomobject]@{ Id=200; Name='powershell'; StartTicks=2L; Priority='Normal'; Cpu=0; RamStr='10 MB'; IsProtected=$false; IsEditor=$false }
$script:CachedProcs = @($chat, $shell)
Filter-Grid
$listView.Items[0].Selected = $true
$listView.TopItem = $listView.Items[0]
$script:CachedProcs = @($shell, $chat)
Filter-Grid
Assert ($listView.SelectedItems.Count -eq 1 -and $listView.SelectedItems[0].Tag.Id -eq 100) 'Selection follows identity through a reordered refresh'
$chat.StartTicks = 3L
# Prior rows hold the old snapshot object, as real refreshed process data does.
$replacement = [pscustomobject]@{ Id=100; Name='ChatGPT'; StartTicks=4L; Priority='Normal'; Cpu=0; RamStr='10 MB'; IsProtected=$false; IsEditor=$false }
$script:CachedProcs = @($shell, $replacement)
Filter-Grid
Assert ($listView.SelectedItems.Count -eq 0) 'Selection clears when the selected process is replaced'
$txtSearch.Text = 'no-such-process'
Filter-Grid
Assert ($listView.Items.Count -eq 0 -and -not $listView.Updating) 'Empty filter completes the redraw'

# Licensing tests use only disposable, synthetic test credentials.
$temp = Join-Path ([IO.Path]::GetTempPath()) ('qh-test-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $temp | Out-Null
try {
    $script:TrialPath = Join-Path $temp 'trial.dat'
    $script:TrialDays = 3
    Start-Trial
    Assert (Test-TrialActive) 'A new three-day trial starts'
    $record = Get-Content $script:TrialPath -Raw | ConvertFrom-Json
    $started = [datetimeoffset]::Parse($record.StartDate)
    Assert (([datetimeoffset]::Parse($record.Expiry) - $started).TotalHours -eq 72) 'Trial grant is exactly 72 hours'
    Assert (Get-TrialWindow $record $started.AddHours(72).AddTicks(-1)).Active 'Trial remains active just before its deadline'
    Assert (-not (Get-TrialWindow $record $started.AddHours(72)).Active) 'Trial expires exactly at its deadline'
    Assert (-not (Get-TrialWindow $record $started.AddHours(73)).Active) 'Expired trial stays expired'
    $oldTrial = [pscustomobject]@{ StartDate=$record.StartDate; Expiry=$started.AddDays(7).ToString('o') }
    Assert (-not (Get-TrialWindow $oldTrial $started.AddHours(73)).Active) 'Legacy seven-day state is capped at three days from its original start'
    Assert (-not (Get-TrialWindow $record $started.AddMinutes(-1))) 'Future-dated trial does not grant time'
    $before = Get-Content $script:TrialPath -Raw
    Start-Trial
    Assert ((Get-Content $script:TrialPath -Raw) -eq $before) 'An active trial is not extended'
    @{ Expiry = (Get-Date).AddDays(-1).ToString('o') } | ConvertTo-Json | Set-Content $script:TrialPath
    $blocked = $false
    try { Start-Trial } catch { $blocked = $true }
    Assert $blocked 'An expired trial cannot restart from the button'
    $script:LicenseActivated = $false
    Assert (-not (Test-SessionAccess)) 'Session access closes when the trial expires'
    $script:LicenseActivated = $true
    Assert (Test-SessionAccess) 'A purchased license remains active after trial expiry'
    $script:LicensePath = Join-Path $temp 'license.dat'
    $script:LicenseSecret = 'synthetic-regression-test-only'
    Save-License 'TEST-ONLY'
    Assert (Test-LicenseValid) 'Existing signed license storage still validates'
    $script:LicenseSecret = ''
    Assert (-not (Test-LicenseValid)) 'Missing signing secret fails closed'

    # Test new customer licensing with an ephemeral key unrelated to the owner key.
    $rsa = [Security.Cryptography.RSA]::Create()
    try {
        $rsa.KeySize = 2048
        $script:LicensePublicKey = $rsa.ToXmlString($false)
        $payloadBytes = [Text.Encoding]::UTF8.GetBytes('{"product":"QuadraHydra","edition":"Lifetime","id":"1234567890abcdef1234567890abcdef"}')
        $sig = $rsa.SignData($payloadBytes, [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1)
        $signedKey = 'QH1.' + [Convert]::ToBase64String($payloadBytes) + '.' + [Convert]::ToBase64String($sig)
        Assert (Test-SignedLicense $signedKey) 'Customer license verifies with a public key only'
        Save-License $signedKey
        Assert (Test-LicenseValid) 'Signed license persists and reloads without any shared secret'
        $sig[0] = $sig[0] -bxor 1
        $tampered = 'QH1.' + [Convert]::ToBase64String($payloadBytes) + '.' + [Convert]::ToBase64String($sig)
        Assert (-not (Test-SignedLicense $tampered)) 'Modified signature is rejected'
        $payloadBytes[0] = 32
        $tamperedPayload = 'QH1.' + [Convert]::ToBase64String($payloadBytes) + '.' + $signedKey.Split('.')[2]
        Assert (-not (Test-SignedLicense $tamperedPayload)) 'Modified license payload is rejected'
        $wrongProduct = [Text.Encoding]::UTF8.GetBytes('{"product":"OtherApp","edition":"Lifetime","id":"1234567890abcdef1234567890abcdef"}')
        $wrongSig = $rsa.SignData($wrongProduct, [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1)
        $wrongKey = 'QH1.' + [Convert]::ToBase64String($wrongProduct) + '.' + [Convert]::ToBase64String($wrongSig)
        Assert (-not (Test-SignedLicense $wrongKey)) 'A signature for another product cannot activate QuadraHydra'
        Assert (-not (Test-SignedLicense 'QH1.not-base64.invalid')) 'Malformed signed license fails cleanly'
    } finally { $rsa.Dispose() }
} finally { Remove-Item -LiteralPath $temp -Recurse -Force }

# Verify native interop declarations without invoking Windows APIs.
$suspendNode = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.AssignmentStatementAst] -and $n.Left.Extent.Text -eq '$suspendCode' }, $true)
. ([scriptblock]::Create($suspendNode.Extent.Text))
Add-Type -TypeDefinition $suspendCode
Assert ([Runtime.InteropServices.Marshal]::SizeOf([type][ProcessSuspender+THREADENTRY32]) -eq 28) 'Windows thread structure uses the required 28-byte layout'
Assert ([ProcessSuspender].GetMethod('SuspendThread').ReturnType -eq [uint32]) 'SuspendThread returns a DWORD status'
Assert ([ProcessSuspender].GetMethod('ResumeThread').ReturnType -eq [uint32]) 'ResumeThread returns a DWORD status'

$script:UpdateTimer = $null
$script:UpdateJob = Start-Job { 'done' }
$jobId = $script:UpdateJob.Id
$script:UpdateJob | Wait-Job -Timeout 10 | Out-Null
Clear-UpdateJob
Assert (-not $script:UpdateJob -and -not (Get-Job -Id $jobId -ErrorAction SilentlyContinue)) 'Update cleanup removes its child job'
Write-Output "All $script:checks regression checks passed."
