param(
  [string]$EnvFile = "sentinel-agent/.env",
  [int]$TimeoutMinutes = 120,
  [int]$MaxScans = 200,
  [switch]$ApplyCleanup,
  [switch]$SendWebhook,
  [string]$WebhookUrl = ""
)

$ErrorActionPreference = 'Stop'

function Get-EnvValue {
  param(
    [string]$Content,
    [string]$Key
  )

  $match = [regex]::Match($Content, "(?m)^$Key\s*=\s*(.+)$")
  if (-not $match.Success) {
    throw "Missing required key in env file: $Key"
  }

  return $match.Groups[1].Value.Trim().Trim('"').Trim("'")
}

function Get-OptionalEnvValue {
  param(
    [string]$Content,
    [string]$Key
  )

  $match = [regex]::Match($Content, "(?m)^$Key\s*=\s*(.+)$")
  if (-not $match.Success) {
    return ""
  }

  return $match.Groups[1].Value.Trim().Trim('"').Trim("'")
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers,
    [object]$Body
  )

  $jsonBody = if ($null -ne $Body) { $Body | ConvertTo-Json -Depth 10 } else { $null }

  try {
    $resp = Invoke-WebRequest -Method $Method -Uri $Uri -Headers $Headers -Body $jsonBody -UseBasicParsing
    return [pscustomobject]@{
      StatusCode = $resp.StatusCode
      Json = if ($resp.Content) { $resp.Content | ConvertFrom-Json } else { $null }
      Raw = $resp.Content
    }
  } catch {
    $status = $null
    $raw = ''
    if ($_.Exception.Response) {
      try {
        $status = [int]$_.Exception.Response.StatusCode
      } catch {
        $status = $null
      }
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $raw = $reader.ReadToEnd()
      } catch {
        $raw = $_.Exception.Message
      }
    } else {
      $raw = $_.Exception.Message
    }

    return [pscustomobject]@{
      StatusCode = $status
      Json = $null
      Raw = $raw
    }
  }
}

function Get-Sha256Hex {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $hash = $sha.ComputeHash($bytes)
    return ([System.BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

if (-not (Test-Path $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

if ($TimeoutMinutes -lt 1) {
  throw "TimeoutMinutes must be >= 1"
}

if ($MaxScans -lt 1) {
  throw "MaxScans must be >= 1"
}

$content = Get-Content $EnvFile -Raw
$supabaseUrl = Get-EnvValue -Content $content -Key 'SUPABASE_URL'
$supabaseServiceRoleKey = Get-EnvValue -Content $content -Key 'SUPABASE_SERVICE_ROLE_KEY'
$envWebhook = Get-OptionalEnvValue -Content $content -Key 'OPERATIONAL_ALERT_WEBHOOK_URL'
$effectiveWebhook = if (-not [string]::IsNullOrWhiteSpace($WebhookUrl)) { $WebhookUrl.Trim() } else { $envWebhook }

$restHeaders = @{
  'apikey' = $supabaseServiceRoleKey
  'Authorization' = "Bearer $supabaseServiceRoleKey"
  'Content-Type' = 'application/json'
}

$nowUtc = (Get-Date).ToUniversalTime()
$cutoffIso = $nowUtc.AddMinutes(-1 * $TimeoutMinutes).ToString('o')

function Get-StaleJobs {
  param(
    [string]$BaseUrl,
    [string]$Cutoff,
    [int]$Limit,
    [hashtable]$Headers
  )

  $uri = "$BaseUrl/rest/v1/scan_jobs?select=id,scan_id,status,started_at,error_message&status=eq.running&started_at=lt.$([System.Uri]::EscapeDataString($Cutoff))&order=started_at.asc&limit=$Limit"
  $res = Invoke-JsonRequest -Method 'GET' -Uri $uri -Headers $Headers -Body $null
  if ($res.StatusCode -ne 200) {
    throw "Failed to fetch stale jobs. HTTP=$($res.StatusCode) Body=$($res.Raw)"
  }

  if ($res.Json) {
    return @($res.Json)
  }

  return @()
}

function Get-OrphanRunningScans {
  param(
    [string]$BaseUrl,
    [string]$Cutoff,
    [int]$Limit,
    [hashtable]$Headers
  )

  $runningScansUri = "$BaseUrl/rest/v1/scans?select=id,status,started_at,completed_at&status=eq.running&started_at=lt.$([System.Uri]::EscapeDataString($Cutoff))&order=started_at.asc&limit=$Limit"
  $runningRes = Invoke-JsonRequest -Method 'GET' -Uri $runningScansUri -Headers $Headers -Body $null
  if ($runningRes.StatusCode -ne 200) {
    throw "Failed to fetch running scans for orphan check. HTTP=$($runningRes.StatusCode) Body=$($runningRes.Raw)"
  }

  $runningScans = @()
  if ($runningRes.Json) {
    $runningScans = @($runningRes.Json)
  }

  $orphans = @()
  foreach ($scan in $runningScans) {
    $scanId = [string]$scan.id
    if ([string]::IsNullOrWhiteSpace($scanId)) {
      continue
    }

    $activeJobUri = "$BaseUrl/rest/v1/scan_jobs?select=id,status&scan_id=eq.$scanId&status=in.(pending,running)&limit=1"
    $activeJobRes = Invoke-JsonRequest -Method 'GET' -Uri $activeJobUri -Headers $Headers -Body $null
    if ($activeJobRes.StatusCode -ne 200) {
      throw "Failed to check active jobs for scan $scanId. HTTP=$($activeJobRes.StatusCode) Body=$($activeJobRes.Raw)"
    }

    $activeJobs = @()
    if ($activeJobRes.Json) {
      $activeJobs = @($activeJobRes.Json)
    }

    if ($activeJobs.Count -eq 0) {
      $orphans += $scan
    }
  }

  return @($orphans)
}

function Resolve-OrphanRunningScans {
  param(
    [string]$BaseUrl,
    [array]$OrphanScans,
    [hashtable]$Headers
  )

  $attempted = 0
  $succeeded = 0
  $failed = @()
  $completedAt = (Get-Date).ToUniversalTime().ToString('o')

  foreach ($scan in $OrphanScans) {
    $scanId = [string]$scan.id
    if ([string]::IsNullOrWhiteSpace($scanId)) {
      continue
    }

    $attempted++
    $patchBody = @{
      status = 'failed'
      completed_at = $completedAt
    }
    $patchUri = "$BaseUrl/rest/v1/scans?id=eq.$scanId"
    $patchRes = Invoke-JsonRequest -Method 'PATCH' -Uri $patchUri -Headers $Headers -Body $patchBody

    if ($patchRes.StatusCode -ge 200 -and $patchRes.StatusCode -lt 300) {
      $succeeded++
    } else {
      $failed += [pscustomobject]@{
        scan_id = $scanId
        http = $patchRes.StatusCode
        raw = $patchRes.Raw
      }
    }
  }

  return [pscustomobject]@{
    attempted = $attempted
    succeeded = $succeeded
    failed_count = $failed.Count
    failed_sample = @($failed | Select-Object -First 20)
  }
}

$beforeStaleJobs = Get-StaleJobs -BaseUrl $supabaseUrl -Cutoff $cutoffIso -Limit $MaxScans -Headers $restHeaders
$beforeOrphanRunningScans = Get-OrphanRunningScans -BaseUrl $supabaseUrl -Cutoff $cutoffIso -Limit $MaxScans -Headers $restHeaders
$beforeScanIds = @($beforeStaleJobs | Where-Object { $_.scan_id } | ForEach-Object { $_.scan_id } | Select-Object -Unique)

$affectedScans = @()
if ($beforeScanIds.Count -gt 0) {
  $filters = ($beforeScanIds | ForEach-Object { 'id.eq.' + $_ }) -join ','
  $scansUri = "$supabaseUrl/rest/v1/scans?select=id,status,started_at,completed_at&or=($([System.Uri]::EscapeDataString($filters)))"
  $scansRes = Invoke-JsonRequest -Method 'GET' -Uri $scansUri -Headers $restHeaders -Body $null
  if ($scansRes.StatusCode -eq 200 -and $scansRes.Json) {
    $affectedScans = @($scansRes.Json)
  }
}

$cleanupRes = $null
if ($ApplyCleanup -and $beforeStaleJobs.Count -gt 0) {
  $cleanupRes = Invoke-JsonRequest -Method 'POST' -Uri "$supabaseUrl/rest/v1/rpc/cleanup_stale_running_jobs" -Headers $restHeaders -Body @{ timeout_minutes = $TimeoutMinutes }
}

$orphanCleanupRes = $null
if ($ApplyCleanup -and $beforeOrphanRunningScans.Count -gt 0) {
  $orphanCleanupRes = Resolve-OrphanRunningScans -BaseUrl $supabaseUrl -OrphanScans $beforeOrphanRunningScans -Headers $restHeaders
}

$afterStaleJobs = Get-StaleJobs -BaseUrl $supabaseUrl -Cutoff $cutoffIso -Limit $MaxScans -Headers $restHeaders
$afterOrphanRunningScans = Get-OrphanRunningScans -BaseUrl $supabaseUrl -Cutoff $cutoffIso -Limit $MaxScans -Headers $restHeaders

$cleanupAttempted = $ApplyCleanup.IsPresent -and (($beforeStaleJobs.Count -gt 0) -or ($beforeOrphanRunningScans.Count -gt 0))
$cleanupOk = $null
if ($cleanupAttempted) {
  $staleCleanupOk = $true
  if ($beforeStaleJobs.Count -gt 0) {
    $staleCleanupOk = $cleanupRes.StatusCode -ge 200 -and $cleanupRes.StatusCode -lt 300
  }

  $orphanCleanupOk = $true
  if ($beforeOrphanRunningScans.Count -gt 0) {
    $orphanCleanupOk = $orphanCleanupRes.failed_count -eq 0
  }

  $cleanupOk = $staleCleanupOk -and $orphanCleanupOk
}

$recoveryOutcome = 'no_stale_detected'
if (($beforeStaleJobs.Count -gt 0 -or $beforeOrphanRunningScans.Count -gt 0) -and -not $ApplyCleanup.IsPresent) {
  $recoveryOutcome = 'dry_run_detected_stale'
} elseif ($cleanupAttempted -and -not $cleanupOk) {
  $recoveryOutcome = 'cleanup_failed'
} elseif ($cleanupAttempted -and $cleanupOk -and ($afterStaleJobs.Count -eq 0) -and ($afterOrphanRunningScans.Count -eq 0)) {
  $recoveryOutcome = 'cleanup_succeeded'
} elseif ($cleanupAttempted -and $cleanupOk -and (($afterStaleJobs.Count -lt $beforeStaleJobs.Count) -or ($afterOrphanRunningScans.Count -lt $beforeOrphanRunningScans.Count))) {
  $recoveryOutcome = 'cleanup_improved'
} elseif ($cleanupAttempted -and $cleanupOk) {
  $recoveryOutcome = 'cleanup_no_change'
}

$summary = [pscustomobject]@{
  mode = if ($ApplyCleanup) { 'apply' } else { 'dry-run' }
  timeout_minutes = $TimeoutMinutes
  max_scans = $MaxScans
  cutoff_iso = $cutoffIso
  stale_running_jobs_before_count = $beforeStaleJobs.Count
  stale_running_jobs_after_count = $afterStaleJobs.Count
  orphan_running_scans_before_count = $beforeOrphanRunningScans.Count
  orphan_running_scans_after_count = $afterOrphanRunningScans.Count
  orphan_running_scans_cleaned_count = if ($orphanCleanupRes) { $orphanCleanupRes.succeeded } else { 0 }
  affected_scans_count = $affectedScans.Count
  recovery_outcome = $recoveryOutcome
  cleanup_attempted = $cleanupAttempted
  cleanup_http = if ($cleanupRes) { $cleanupRes.StatusCode } else { $null }
  cleanup_ok = $cleanupOk
  cleanup_body = if ($cleanupRes) { $cleanupRes.Raw } else { $null }
  orphan_cleanup_failed_count = if ($orphanCleanupRes) { $orphanCleanupRes.failed_count } else { 0 }
  orphan_cleanup_failed_sample = if ($orphanCleanupRes) { $orphanCleanupRes.failed_sample } else { @() }
  stale_jobs_before_sample = $beforeStaleJobs | Select-Object -First 20
  stale_jobs_after_sample = $afterStaleJobs | Select-Object -First 20
  orphan_running_scans_before_sample = $beforeOrphanRunningScans | Select-Object -First 20
  orphan_running_scans_after_sample = $afterOrphanRunningScans | Select-Object -First 20
  affected_scans_sample = $affectedScans | Select-Object -First 20
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
}

$evidenceSummaryPayload = [pscustomobject]@{
  summary = $summary
}
$evidenceHash = Get-Sha256Hex -Text ($evidenceSummaryPayload | ConvertTo-Json -Depth 14 -Compress)
$evidenceId = "recovery-playbook-$($nowUtc.ToString('yyyyMMddTHHmmssZ'))-$($evidenceHash.Substring(0, 12))"

$result = [pscustomobject]@{
  schema_version = '1.0'
  report_type = 'scan_pipeline_recovery_playbook'
  evidence_id = $evidenceId
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
  run_context = [pscustomobject]@{
    script = 'scripts/recovery-playbook.ps1'
    parameters = [pscustomobject]@{
      timeout_minutes = $TimeoutMinutes
      max_scans = $MaxScans
      apply_cleanup = $ApplyCleanup.IsPresent
      send_webhook = $SendWebhook.IsPresent
    }
  }
  integrity = [pscustomobject]@{
    algorithm = 'sha256'
    payload_hash = $evidenceHash
  }
  summary = $summary
  apply_cleanup = $ApplyCleanup.IsPresent
  send_webhook = $SendWebhook.IsPresent
  webhook_status = $null
}

$webhookStatus = $null
if ($SendWebhook) {
  if ([string]::IsNullOrWhiteSpace($effectiveWebhook)) {
    throw "SendWebhook=true but no webhook URL configured"
  }

  $severity = if (($summary.stale_running_jobs_after_count -gt 0 -or $summary.orphan_running_scans_after_count -gt 0) -and $ApplyCleanup) { 'warning' } elseif ($summary.stale_running_jobs_before_count -gt 0 -or $summary.orphan_running_scans_before_count -gt 0) { 'warning' } else { 'info' }
  $payload = [pscustomobject]@{
    event = 'scan_pipeline_recovery_playbook'
    source = 'sentinel-agent-ops'
    severity = $severity
    evidence_id = $evidenceId
    summary = $summary
  }

  $webhookRes = Invoke-JsonRequest -Method 'POST' -Uri $effectiveWebhook -Headers @{ 'Content-Type' = 'application/json' } -Body $payload
  $webhookStatus = [pscustomobject]@{
    http = $webhookRes.StatusCode
    ok = $webhookRes.StatusCode -ge 200 -and $webhookRes.StatusCode -lt 300
    raw = $webhookRes.Raw
  }

  $result.webhook_status = $webhookStatus
}

$result | ConvertTo-Json -Depth 14

if ($cleanupAttempted) {
  if (-not $cleanupOk) {
    throw "Recovery cleanup RPC failed. HTTP=$($summary.cleanup_http)"
  }

  if ($summary.stale_running_jobs_after_count -ge $summary.stale_running_jobs_before_count -and $summary.stale_running_jobs_before_count -gt 0 -and $summary.orphan_running_scans_before_count -eq 0) {
    throw "Recovery cleanup completed but stale jobs were not reduced. before=$($summary.stale_running_jobs_before_count) after=$($summary.stale_running_jobs_after_count)"
  }

  if ($summary.orphan_running_scans_after_count -ge $summary.orphan_running_scans_before_count -and $summary.orphan_running_scans_before_count -gt 0) {
    throw "Recovery cleanup completed but orphan scans were not reduced. before=$($summary.orphan_running_scans_before_count) after=$($summary.orphan_running_scans_after_count)"
  }
}

if ($SendWebhook -and $null -ne $webhookStatus -and -not $webhookStatus.ok) {
  throw "Recovery playbook webhook failed. HTTP=$($webhookStatus.http)"
}
