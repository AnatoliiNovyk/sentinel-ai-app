param(
  [string]$EnvFile = "sentinel-agent/.env",
  [int]$DaysBack = 7,
  [int]$SlaDurationThresholdMinutes = 60,
  [double]$MinSuccessRatePercent = 95,
  [double]$MaxFailureRatePercent = 5,
  [double]$MaxSlaBreachRatePercent = 10,
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

if ($DaysBack -lt 1) {
  throw "DaysBack must be >= 1"
}

if ($SlaDurationThresholdMinutes -lt 1) {
  throw "SlaDurationThresholdMinutes must be >= 1"
}

if ($MinSuccessRatePercent -lt 0 -or $MinSuccessRatePercent -gt 100) {
  throw "MinSuccessRatePercent must be in range 0..100"
}

if ($MaxFailureRatePercent -lt 0 -or $MaxFailureRatePercent -gt 100) {
  throw "MaxFailureRatePercent must be in range 0..100"
}

if ($MaxSlaBreachRatePercent -lt 0 -or $MaxSlaBreachRatePercent -gt 100) {
  throw "MaxSlaBreachRatePercent must be in range 0..100"
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
$fromUtc = $nowUtc.AddDays(-1 * $DaysBack)
$fromIso = $fromUtc.ToString('o')

$scansUri = "$supabaseUrl/rest/v1/scans?select=id,status,started_at,completed_at&started_at=gte.$([System.Uri]::EscapeDataString($fromIso))&order=started_at.asc"
$scansRes = Invoke-JsonRequest -Method 'GET' -Uri $scansUri -Headers $restHeaders -Body $null
if ($scansRes.StatusCode -ne 200) {
  throw "Failed to fetch scans. HTTP=$($scansRes.StatusCode) Body=$($scansRes.Raw)"
}

$scans = @()
if ($scansRes.Json) {
  $scans = @($scansRes.Json)
}

$totalScans = $scans.Count
$completedScans = @($scans | Where-Object { $_.status -eq 'completed' })
$failedScans = @($scans | Where-Object { $_.status -eq 'failed' })

$successRatePercent = 0
$failureRatePercent = 0
if ($totalScans -gt 0) {
  $successRatePercent = [math]::Round(($completedScans.Count * 100.0) / $totalScans, 2)
  $failureRatePercent = [math]::Round(($failedScans.Count * 100.0) / $totalScans, 2)
}

$completedDurationsMinutes = @()
foreach ($s in $completedScans) {
  if ($s.started_at -and $s.completed_at) {
    $started = Convert-ToUtcDateTimeOffset -Value $s.started_at
    $completed = Convert-ToUtcDateTimeOffset -Value $s.completed_at
    $delta = ($completed - $started).TotalMinutes
    if ($delta -ge 0) {
      $completedDurationsMinutes += [math]::Round($delta, 2)
    }
  }
}

$avgDurationMinutes = 0
$p95DurationMinutes = 0
if ($completedDurationsMinutes.Count -gt 0) {
  $sorted = @($completedDurationsMinutes | Sort-Object)
  $avgDurationMinutes = [math]::Round(($sorted | Measure-Object -Average).Average, 2)
  $index = [int][math]::Ceiling($sorted.Count * 0.95) - 1
  if ($index -lt 0) { $index = 0 }
  if ($index -ge $sorted.Count) { $index = $sorted.Count - 1 }
  $p95DurationMinutes = [math]::Round([double]$sorted[$index], 2)
}

$slaBreachedCount = 0
if ($completedDurationsMinutes.Count -gt 0) {
  $slaBreachedCount = @($completedDurationsMinutes | Where-Object { $_ -gt $SlaDurationThresholdMinutes }).Count
}

$slaBreachRatePercent = 0
if ($completedDurationsMinutes.Count -gt 0) {
  $slaBreachRatePercent = [math]::Round(($slaBreachedCount * 100.0) / $completedDurationsMinutes.Count, 2)
}

$thresholdBreaches = @()
if ($successRatePercent -lt $MinSuccessRatePercent) {
  $thresholdBreaches += [pscustomobject]@{
    type = 'min_success_rate_percent'
    actual = $successRatePercent
    threshold = $MinSuccessRatePercent
  }
}
if ($failureRatePercent -gt $MaxFailureRatePercent) {
  $thresholdBreaches += [pscustomobject]@{
    type = 'max_failure_rate_percent'
    actual = $failureRatePercent
    threshold = $MaxFailureRatePercent
  }
}
if ($slaBreachRatePercent -gt $MaxSlaBreachRatePercent) {
  $thresholdBreaches += [pscustomobject]@{
    type = 'max_sla_breach_rate_percent'
    actual = $slaBreachRatePercent
    threshold = $MaxSlaBreachRatePercent
  }
}

$summary = [pscustomobject]@{
  window = [pscustomobject]@{
    days_back = $DaysBack
    from_utc = $fromIso
    to_utc = $nowUtc.ToString('o')
  }
  scans_total = $totalScans
  scans_completed = $completedScans.Count
  scans_failed = $failedScans.Count
  success_rate_percent = $successRatePercent
  failure_rate_percent = $failureRatePercent
  sla_duration_threshold_minutes = $SlaDurationThresholdMinutes
  avg_completed_duration_minutes = $avgDurationMinutes
  p95_completed_duration_minutes = $p95DurationMinutes
  sla_breached_scans_count = $slaBreachedCount
  sla_breach_rate_percent = $slaBreachRatePercent
  thresholds = [pscustomobject]@{
    min_success_rate_percent = $MinSuccessRatePercent
    max_failure_rate_percent = $MaxFailureRatePercent
    max_sla_breach_rate_percent = $MaxSlaBreachRatePercent
  }
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
}

$thresholdsOk = $thresholdBreaches.Count -eq 0

$evidenceSummaryPayload = [pscustomobject]@{
  summary = $summary
  thresholds_ok = $thresholdsOk
  threshold_breaches = $thresholdBreaches
}
$evidenceHash = Get-Sha256Hex -Text ($evidenceSummaryPayload | ConvertTo-Json -Depth 12 -Compress)
$evidenceId = "weekly-slo-sla-$($nowUtc.ToString('yyyyMMddTHHmmssZ'))-$($evidenceHash.Substring(0, 12))"

$result = [pscustomobject]@{
  schema_version = '1.0'
  report_type = 'weekly_slo_sla_summary'
  evidence_id = $evidenceId
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
  run_context = [pscustomobject]@{
    script = 'scripts/weekly-slo-sla-summary.ps1'
    parameters = [pscustomobject]@{
      days_back = $DaysBack
      sla_duration_threshold_minutes = $SlaDurationThresholdMinutes
      min_success_rate_percent = $MinSuccessRatePercent
      max_failure_rate_percent = $MaxFailureRatePercent
      max_sla_breach_rate_percent = $MaxSlaBreachRatePercent
      send_webhook = $SendWebhook.IsPresent
    }
  }
  integrity = [pscustomobject]@{
    algorithm = 'sha256'
    payload_hash = $evidenceHash
  }
  summary = $summary
  thresholds_ok = $thresholdsOk
  threshold_breaches = $thresholdBreaches
  send_webhook = $SendWebhook.IsPresent
  webhook_status = $null
}

if ($SendWebhook) {
  if ([string]::IsNullOrWhiteSpace($effectiveWebhook)) {
    throw 'SendWebhook=true but no webhook URL configured'
  }

  $severity = if ($thresholdsOk) { 'info' } else { 'warning' }
  $payload = [pscustomobject]@{
    event = 'weekly_slo_sla_summary'
    source = 'sentinel-agent-ops'
    severity = $severity
    evidence_id = $evidenceId
    summary = $summary
    thresholds_ok = $thresholdsOk
    threshold_breaches = $thresholdBreaches
  }

  $webhookRes = Invoke-JsonRequest -Method 'POST' -Uri $effectiveWebhook -Headers @{ 'Content-Type' = 'application/json' } -Body $payload
  $result.webhook_status = [pscustomobject]@{
    http = $webhookRes.StatusCode
    ok = $webhookRes.StatusCode -ge 200 -and $webhookRes.StatusCode -lt 300
    raw = $webhookRes.Raw
  }

  if (-not $result.webhook_status.ok) {
    throw "Weekly SLO/SLA webhook failed. HTTP=$($result.webhook_status.http)"
  }
}

$result | ConvertTo-Json -Depth 14
