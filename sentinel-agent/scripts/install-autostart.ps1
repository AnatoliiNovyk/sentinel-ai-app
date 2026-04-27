$ErrorActionPreference = 'Stop'

$TaskName = 'SentinelAgentLocal'
$ScriptPath = Join-Path $PSScriptRoot 'run-agent.ps1'

$UserId = if ($env:USERDOMAIN) { "$($env:USERDOMAIN)\\$($env:USERNAME)" } else { $env:USERNAME }
$PowerShellExe = (Get-Command powershell).Source

if (-not (Test-Path $ScriptPath)) {
    throw "Run script not found: $ScriptPath"
}

$Action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument "-NoProfile -ExecutionPolicy Bypass -File \"$ScriptPath\""
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $UserId
$Principal = New-ScheduledTaskPrincipal -UserId $UserId -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

$Existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description 'Starts local Sentinel Agent at user logon.' | Out-Null

Start-ScheduledTask -TaskName $TaskName

$Created = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $Created) {
    throw "Failed to create scheduled task '$TaskName'."
}

Write-Host "Scheduled task '$TaskName' created and started for user '$UserId'."
