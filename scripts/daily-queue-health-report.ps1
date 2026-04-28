param(
  [string]$EnvFile = "sentinel-agent/.env",
  [int]$HoursBack = 24,
  [int]$StaleMinutes = 60,
  [int]$MaxStaleRunningJobs = 0,
  [double]$MaxErrorJobRatePercent = 40,
  [switch]$FailOnThresholdBreach,
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

function Convert-ToUtcDateTimeOffset {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Value
  )

  if ($Value -is [DateTimeOffset]) {
    return $Value.ToUniversalTime()
  }

  if ($Value -is [DateTime]) {
    return [DateTimeOffset]::new($Value).ToUniversalTime()
  }

  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) {
    throw "Date value is empty"
  }

  return [DateTimeOffset]::Parse($text, [System.Globalization.CultureInfo]::InvariantCulture).ToUniversalTime()
}

if (-not (Test-Path $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

if ($HoursBack -lt 1) {
  throw "HoursBack must be >= 1"
}

if ($StaleMinutes -lt 1) {
  throw "StaleMinutes must be >= 1"
}

if ($MaxStaleRunningJobs -lt 0) {
  throw "MaxStaleRunningJobs must be >= 0"
}

if ($MaxErrorJobRatePercent -lt 0 -or $MaxErrorJobRatePercent -gt 100) {
  throw "MaxErrorJobRatePercent must be in range 0..100"
}

$content = Get-Content $EnvFile -Raw
$supabaseUrl = Get-EnvValue -Content $content -Key 'SUPABASE_URL'
$supabaseServiceRoleKey = Get-EnvValue -Content $content -Key 'SUPABASE_SERVICE_ROLE_KEY'
$operationalWebhookFromEnv = [regex]::Match($content, "(?m)^OPERATIONAL_ALERT_WEBHOOK_URL\s*=\s*(.+)$")
if (-not [string]::IsNullOrWhiteSpace($WebhookUrl)) {
  $effectiveWebhookUrl = $WebhookUrl.Trim()
} elseif ($operationalWebhookFromEnv.Success) {
  $effectiveWebhookUrl = $operationalWebhookFromEnv.Groups[1].Value.Trim().Trim('"').Trim("'")
} else {
  $effectiveWebhookUrl = ''
}

$restHeaders = @{
  'apikey' = $supabaseServiceRoleKey
  'Authorization' = "Bearer $supabaseServiceRoleKey"
  'Content-Type' = 'application/json'
}

$nowUtc = (Get-Date).ToUniversalTime()
$fromUtc = $nowUtc.AddHours(-1 * $HoursBack)
$staleBeforeUtc = $nowUtc.AddMinutes(-1 * $StaleMinutes)
$fromIso = $fromUtc.ToString('o')
$staleBeforeIso = $staleBeforeUtc.ToString('o')

$scansUri = "$supabaseUrl/rest/v1/scans?select=id,status,started_at,completed_at&started_at=gte.$([System.Uri]::EscapeDataString($fromIso))&order=started_at.asc"
$jobsUri = "$supabaseUrl/rest/v1/scan_jobs?select=id,scan_id,status,error_message,started_at,completed_at&started_at=gte.$([System.Uri]::EscapeDataString($fromIso))&order=started_at.asc"

$scansRes = Invoke-JsonRequest -Method 'GET' -Uri $scansUri -Headers $restHeaders -Body $null
if ($scansRes.StatusCode -ne 200) {
  throw "Failed to fetch scans. HTTP=$($scansRes.StatusCode) Body=$($scansRes.Raw)"
}

$jobsRes = Invoke-JsonRequest -Method 'GET' -Uri $jobsUri -Headers $restHeaders -Body $null
if ($jobsRes.StatusCode -ne 200) {
  throw "Failed to fetch scan_jobs. HTTP=$($jobsRes.StatusCode) Body=$($jobsRes.Raw)"
}

$scans = @()
if ($scansRes.Json) { $scans = @($scansRes.Json) }
$jobs = @()
if ($jobsRes.Json) { $jobs = @($jobsRes.Json) }

$scanStatusCounts = @{}
foreach ($s in $scans) {
  $k = [string]$s.status
  if (-not $scanStatusCounts.ContainsKey($k)) { $scanStatusCounts[$k] = 0 }
  $scanStatusCounts[$k]++
}

$jobStatusCounts = @{}
foreach ($j in $jobs) {
  $k = [string]$j.status
  if (-not $jobStatusCounts.ContainsKey($k)) { $jobStatusCounts[$k] = 0 }
  $jobStatusCounts[$k]++
}

$completedScanDurationsSec = @()
foreach ($s in $scans) {
  if ($s.started_at -and $s.completed_at) {
    $started = Convert-ToUtcDateTimeOffset -Value $s.started_at
    $completed = Convert-ToUtcDateTimeOffset -Value $s.completed_at
    $delta = ($completed - $started).TotalSeconds
    if ($delta -ge 0) {
      $completedScanDurationsSec += [math]::Round($delta, 2)
    }
  }
}

$avgScanDurationSec = 0
if ($completedScanDurationsSec.Count -gt 0) {
  $avgScanDurationSec = [math]::Round(($completedScanDurationsSec | Measure-Object -Average).Average, 2)
}

$staleRunningJobs = @(
  $jobs | Where-Object {
    $_.status -eq 'running' -and $_.started_at -and (Convert-ToUtcDateTimeOffset -Value $_.started_at).UtcDateTime -lt $staleBeforeUtc
  }
)

$errorJobs = @($jobs | Where-Object { $_.status -eq 'error' -and -not [string]::IsNullOrWhiteSpace($_.error_message) })
$errorJobRatePercent = 0
if ($jobs.Count -gt 0) {
  $errorJobRatePercent = [math]::Round(($errorJobs.Count * 100.0) / $jobs.Count, 2)
}
$topErrors = @()
if ($errorJobs.Count -gt 0) {
  $topErrors = @(
    $errorJobs |
      Group-Object -Property error_message |
      Sort-Object Count -Descending |
      Select-Object -First 5 |
      ForEach-Object {
        [pscustomobject]@{
          error_message = $_.Name
          count = $_.Count
        }
      }
  )
}

$summary = [pscustomobject]@{
  window = [pscustomobject]@{
    hours_back = $HoursBack
    from_utc = $fromIso
    to_utc = $nowUtc.ToString('o')
    stale_minutes = $StaleMinutes
    stale_before_utc = $staleBeforeIso
  }
  scans_total = $scans.Count
  scans_by_status = $scanStatusCounts
  jobs_total = $jobs.Count
  jobs_by_status = $jobStatusCounts
  avg_completed_scan_duration_sec = $avgScanDurationSec
  stale_running_jobs_count = $staleRunningJobs.Count
  stale_running_jobs = $staleRunningJobs | Select-Object -First 20
  error_jobs_count = $errorJobs.Count
  error_job_rate_percent = $errorJobRatePercent
  top_job_errors = $topErrors
  thresholds = [pscustomobject]@{
    max_stale_running_jobs = $MaxStaleRunningJobs
    max_error_job_rate_percent = $MaxErrorJobRatePercent
  }
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
}

$thresholdBreaches = @()
if ($staleRunningJobs.Count -gt $MaxStaleRunningJobs) {
  $thresholdBreaches += [pscustomobject]@{
    type = 'stale_running_jobs'
    actual = $staleRunningJobs.Count
    threshold = $MaxStaleRunningJobs
  }
}
if ($errorJobRatePercent -gt $MaxErrorJobRatePercent) {
  $thresholdBreaches += [pscustomobject]@{
    type = 'error_job_rate_percent'
    actual = $errorJobRatePercent
    threshold = $MaxErrorJobRatePercent
  }
}

$thresholdsOk = $thresholdBreaches.Count -eq 0

$webhookStatus = $null
if ($SendWebhook) {
  if ([string]::IsNullOrWhiteSpace($effectiveWebhookUrl)) {
    throw "SendWebhook=true but webhook URL is empty. Provide -WebhookUrl or OPERATIONAL_ALERT_WEBHOOK_URL in env."
  }

  $webhookPayload = [pscustomobject]@{
    event = 'daily_scan_pipeline_health_report'
    severity = if ($thresholdsOk) { 'info' } else { 'warning' }
    source = 'sentinel-agent-ops'
    summary = $summary
    thresholds_ok = $thresholdsOk
    threshold_breaches = $thresholdBreaches
  }

  $webhookRes = Invoke-JsonRequest -Method 'POST' -Uri $effectiveWebhookUrl -Headers @{ 'Content-Type' = 'application/json' } -Body $webhookPayload
  $webhookStatus = [pscustomobject]@{
    http = $webhookRes.StatusCode
    ok = $webhookRes.StatusCode -ge 200 -and $webhookRes.StatusCode -lt 300
    raw = $webhookRes.Raw
  }
}

[pscustomobject]@{
  summary = $summary
  thresholds_ok = $thresholdsOk
  threshold_breaches = $thresholdBreaches
  fail_on_threshold_breach = $FailOnThresholdBreach.IsPresent
  send_webhook = $SendWebhook.IsPresent
  webhook_status = $webhookStatus
} | ConvertTo-Json -Depth 12

if ($FailOnThresholdBreach -and -not $thresholdsOk) {
  throw "Daily health thresholds breached: $($thresholdBreaches | ConvertTo-Json -Compress)"
}
