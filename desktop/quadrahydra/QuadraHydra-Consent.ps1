#Requires -Version 5.1
# Copyright (c) 2026 Avery Logic Works. Subject to the supplied license terms.
$script:QuadraHydraTermsVersion = 'QH-TERMS-2026-09-03'
function Get-QuadraHydraAgreement([string]$AppDirectory) {
    $terms = Join-Path $AppDirectory 'legal\TERMS_OF_SERVICE.md'
    $privacy = Join-Path $AppDirectory 'legal\PRIVACY_POLICY.md'
    if (-not (Test-Path -LiteralPath $terms) -or -not (Test-Path -LiteralPath $privacy)) {
        throw 'The QuadraHydra legal files are missing. Extract the complete official ZIP before starting.'
    }
    return [pscustomobject]@{
        Version = $script:QuadraHydraTermsVersion
        TermsHash = (Get-FileHash -LiteralPath $terms -Algorithm SHA256).Hash
        PrivacyHash = (Get-FileHash -LiteralPath $privacy -Algorithm SHA256).Hash
        TermsPath = $terms
        PrivacyPath = $privacy
    }
}
function Test-QuadraHydraAgreement([string]$RecordPath, $Agreement) {
    try {
        if (-not (Test-Path -LiteralPath $RecordPath)) { return $false }
        $record = Get-Content -LiteralPath $RecordPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
        return ($record.Version -eq $Agreement.Version -and $record.TermsHash -eq $Agreement.TermsHash -and
            $record.PrivacyHash -eq $Agreement.PrivacyHash -and $record.AcceptedUtc)
    } catch { return $false }
}
function Save-QuadraHydraAgreement([string]$RecordPath, $Agreement) {
    $dir = Split-Path $RecordPath -Parent
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $record = [ordered]@{ Version=$Agreement.Version; TermsHash=$Agreement.TermsHash; PrivacyHash=$Agreement.PrivacyHash; AcceptedUtc=[datetime]::UtcNow.ToString('o') }
    $record | ConvertTo-Json | Set-Content -LiteralPath $RecordPath -Encoding UTF8 -ErrorAction Stop
}
function Show-QuadraHydraAgreement([string]$AppDirectory, [string]$DataDirectory) {
    $agreement = Get-QuadraHydraAgreement $AppDirectory
    $path = Join-Path $DataDirectory 'terms-acceptance.json'
    if (Test-QuadraHydraAgreement $path $agreement) { return $true }
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $dialog = New-Object System.Windows.Forms.Form
    $dialog.Text = 'QuadraHydra - Terms and Privacy'
    $dialog.Size = New-Object System.Drawing.Size(820, 680)
    $dialog.MinimumSize = $dialog.Size
    $dialog.StartPosition = 'CenterScreen'
    $dialog.Font = New-Object System.Drawing.Font('Segoe UI', 10)
    $panel = New-Object System.Windows.Forms.Panel
    $panel.Dock = 'Bottom'; $panel.Height = 135
    $label = New-Object System.Windows.Forms.Label
    $label.Text = 'One PC. $15 paid once. The free trial lasts 72 hours after you start it.'
    $label.Location = New-Object System.Drawing.Point(16, 8); $label.AutoSize = $true
    $check = New-Object System.Windows.Forms.CheckBox
    $check.Text = 'I agree to the Terms and Software License and acknowledge the refund policy.'
    $check.Location = New-Object System.Drawing.Point(16, 36); $check.AutoSize = $true
    $accept = New-Object System.Windows.Forms.Button
    $accept.Text = 'I Agree'; $accept.Location = New-Object System.Drawing.Point(550, 80)
    $accept.Size = New-Object System.Drawing.Size(110, 34); $accept.Enabled = $false
    $decline = New-Object System.Windows.Forms.Button
    $decline.Text = 'Decline'; $decline.Location = New-Object System.Drawing.Point(675, 80)
    $decline.Size = New-Object System.Drawing.Size(110, 34); $decline.DialogResult = 'Cancel'
    $check.Add_CheckedChanged({ $accept.Enabled = $check.Checked })
    $accept.Add_Click({
        if (-not $check.Checked) { return }
        try {
            Save-QuadraHydraAgreement $path $agreement
            $dialog.DialogResult = 'OK'; $dialog.Close()
        } catch {
            [System.Windows.Forms.MessageBox]::Show($dialog, 'Your agreement could not be saved. Check that your Windows user can write to its local application-data folder.', 'Could not save agreement', 'OK', 'Warning') | Out-Null
        }
    })
    $panel.Controls.AddRange(@($label, $check, $accept, $decline))
    $tabs = New-Object System.Windows.Forms.TabControl; $tabs.Dock = 'Fill'
    foreach ($item in @(@('Terms and License', $agreement.TermsPath), @('Privacy Notice', $agreement.PrivacyPath))) {
        $tab = New-Object System.Windows.Forms.TabPage; $tab.Text = $item[0]
        $text = New-Object System.Windows.Forms.TextBox
        $text.Multiline = $true; $text.ReadOnly = $true; $text.ScrollBars = 'Vertical'; $text.Dock = 'Fill'
        $text.Text = (Get-Content -LiteralPath $item[1] -Raw -Encoding UTF8) -replace '(?m)^#{1,6}\s*', '' -replace '\*\*', ''
        $text.SelectionStart = 0; $text.SelectionLength = 0
        $tab.Controls.Add($text); $tabs.TabPages.Add($tab)
    }
    $dialog.Controls.Add($tabs); $dialog.Controls.Add($panel); $dialog.CancelButton = $decline
    try { return ($dialog.ShowDialog() -eq 'OK') } finally { $dialog.Dispose() }
}
