param(
  [string]$EnvFile = "sentinel-agent/.env",
  [string]$ReportFile = "reports/daily-scan-health-report.json",
  [switch]$EscalateOnBreach,
  [string]$EscalationSeverity = "high",
  [string]$WebhookUrl = "",
  [int]$MaxAttempts = 3,
  [int]$InitialBackoffSeconds = 2
)

$ErrorActionPreference = 'Stop'

function Get-EnvValueOrEmpty {
  param(
    [string]$Content,
    [string]$Key
  )

  $match = [regex]::Match($Content, "(?m)^$Key\s*=\s*(.+)$")
  if (-not $match.Success) {
    return ''
  }

  return $match.Groups[1].Value.Trim().Trim('"').Trim("'")
}

function Invoke-WebhookWithRetry {
  param(
    [string]$Uri,
    [object]$Payload,
    [int]$AttemptCount,
    [int]$StartBackoffSeconds
  )

  $lastError = $null
  $lastHttp = $null

  for ($attempt = 1; $attempt -le $AttemptCount; $attempt++) {
    try {
      $jsonBody = $Payload | ConvertTo-Json -Depth 12
      $resp = Invoke-WebRequest -Method 'POST' -Uri $Uri -Headers @{ 'Content-Type' = 'application/json' } -Body $jsonBody -UseBasicParsing
      $lastHttp = $resp.StatusCode
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
        return [pscustomobject]@{
          ok = $true
          http = $resp.StatusCode
          attempts = $attempt
          last_error = $null
          raw = $resp.Content
        }
      }

      $lastError = "Unexpected HTTP status: $($resp.StatusCode)"
    } catch {
      $lastHttp = $null
      $lastError = $_.Exception.Message
    }

    if ($attempt -lt $AttemptCount) {
      $sleepSeconds = [math]::Max(1, $StartBackoffSeconds * [math]::Pow(2, $attempt - 1))
      Start-Sleep -Seconds $sleepSeconds
    }
  }

  return [pscustomobject]@{
    ok = $false
    http = $lastHttp
    attempts = $AttemptCount
    last_error = $lastError
    raw = $null
  }
}

if (-not (Test-Path $ReportFile)) {
  throw "Report file not found: $ReportFile"
}

if ($MaxAttempts -lt 1) {
  throw "MaxAttempts must be >= 1"
}

if ($InitialBackoffSeconds -lt 1) {
  throw "InitialBackoffSeconds must be >= 1"
}

$report = Get-Content $ReportFile -Raw | ConvertFrom-Json
$thresholdsOk = $true
if ($null -ne $report.thresholds_ok) {
  $thresholdsOk = [bool]$report.thresholds_ok
}

if (-not $EscalateOnBreach.IsPresent) {
  [pscustomobject]@{
    status = 'skipped'
    reason = 'escalation_disabled'
    thresholds_ok = $thresholdsOk
    escalation_attempted = $false
  } | ConvertTo-Json -Depth 8
  exit 0
}

if ($thresholdsOk) {
  [pscustomobject]@{
    status = 'skipped'
    reason = 'thresholds_ok'
    thresholds_ok = $true
    escalation_attempted = $false
  } | ConvertTo-Json -Depth 8
  exit 0
}

if (-not (Test-Path $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

$content = Get-Content $EnvFile -Raw
$effectiveWebhookUrl = ''
if (-not [string]::IsNullOrWhiteSpace($WebhookUrl)) {
  $effectiveWebhookUrl = $WebhookUrl.Trim()
}
if ([string]::IsNullOrWhiteSpace($effectiveWebhookUrl)) {
  $effectiveWebhookUrl = Get-EnvValueOrEmpty -Content $content -Key 'ESCALATION_ALERT_WEBHOOK_URL'
}
if ([string]::IsNullOrWhiteSpace($effectiveWebhookUrl)) {
  $effectiveWebhookUrl = Get-EnvValueOrEmpty -Content $content -Key 'OPERATIONAL_ALERT_WEBHOOK_URL'
}
if ([string]::IsNullOrWhiteSpace($effectiveWebhookUrl)) {
  throw 'Escalation webhook URL is empty. Provide -WebhookUrl or ESCALATION_ALERT_WEBHOOK_URL/OPERATIONAL_ALERT_WEBHOOK_URL in env.'
}

$payload = [pscustomobject]@{
  event = 'daily_scan_pipeline_threshold_breach'
  severity = $EscalationSeverity
  source = 'sentinel-agent-ops'
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
  summary = $report.summary
  threshold_breaches = $report.threshold_breaches
  thresholds_ok = $false
}

$webhookStatus = Invoke-WebhookWithRetry -Uri $effectiveWebhookUrl -Payload $payload -AttemptCount $MaxAttempts -StartBackoffSeconds $InitialBackoffSeconds

$result = [pscustomobject]@{
  status = if ($webhookStatus.ok) { 'escalated' } else { 'failed' }
  reason = if ($webhookStatus.ok) { 'threshold_breach' } else { 'webhook_failed' }
  thresholds_ok = $false
  escalation_attempted = $true
  escalation_severity = $EscalationSeverity
  webhook_status = $webhookStatus
}

$result | ConvertTo-Json -Depth 10

if (-not $webhookStatus.ok) {
  throw "Escalation webhook failed after $($webhookStatus.attempts) attempts. Last error: $($webhookStatus.last_error)"
}
