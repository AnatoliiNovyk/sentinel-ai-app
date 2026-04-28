param(
  [string]$EnvFile = "sentinel-agent/.env",
  [int]$TimeoutMinutes = 180,
  [int]$MinStaleJobsToCleanup = 3,
  [int]$MaxJobsInspect = 200,
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

if (-not (Test-Path $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

if ($TimeoutMinutes -lt 1) {
  throw "TimeoutMinutes must be >= 1"
}

if ($MinStaleJobsToCleanup -lt 1) {
  throw "MinStaleJobsToCleanup must be >= 1"
}

if ($MaxJobsInspect -lt 1) {
  throw "MaxJobsInspect must be >= 1"
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

$cutoffIso = (Get-Date).ToUniversalTime().AddMinutes(-1 * $TimeoutMinutes).ToString('o')
$staleUri = "$supabaseUrl/rest/v1/scan_jobs?select=id,scan_id,status,started_at,error_message&status=eq.running&started_at=lt.$([System.Uri]::EscapeDataString($cutoffIso))&order=started_at.asc&limit=$MaxJobsInspect"

$staleRes = Invoke-JsonRequest -Method 'GET' -Uri $staleUri -Headers $restHeaders -Body $null
if ($staleRes.StatusCode -ne 200) {
  throw "Failed to fetch stale jobs. HTTP=$($staleRes.StatusCode) Body=$($staleRes.Raw)"
}

$staleJobs = @()
if ($staleRes.Json) {
  $staleJobs = @($staleRes.Json)
}

$shouldCleanup = $staleJobs.Count -ge $MinStaleJobsToCleanup
$cleanupAttempted = $false
$cleanupRes = $null

if ($ApplyCleanup -and $shouldCleanup) {
  $cleanupAttempted = $true
  $cleanupRes = Invoke-JsonRequest -Method 'POST' -Uri "$supabaseUrl/rest/v1/rpc/cleanup_stale_running_jobs" -Headers $restHeaders -Body @{ timeout_minutes = $TimeoutMinutes }
}

$summary = [pscustomobject]@{
  timeout_minutes = $TimeoutMinutes
  min_stale_jobs_to_cleanup = $MinStaleJobsToCleanup
  max_jobs_inspect = $MaxJobsInspect
  cutoff_iso = $cutoffIso
  stale_running_jobs_count = $staleJobs.Count
  should_cleanup = $shouldCleanup
  cleanup_attempted = $cleanupAttempted
  cleanup_http = if ($cleanupRes) { $cleanupRes.StatusCode } else { $null }
  cleanup_ok = if ($cleanupRes) { $cleanupRes.StatusCode -ge 200 -and $cleanupRes.StatusCode -lt 300 } else { $null }
  cleanup_body = if ($cleanupRes) { $cleanupRes.Raw } else { $null }
  stale_jobs_sample = $staleJobs | Select-Object -First 20
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
}

$webhookStatus = $null
if ($SendWebhook) {
  if ([string]::IsNullOrWhiteSpace($effectiveWebhook)) {
    throw "SendWebhook=true but no webhook URL configured"
  }

  $severity = if ($staleJobs.Count -ge $MinStaleJobsToCleanup) { 'warning' } else { 'info' }
  $payload = [pscustomobject]@{
    event = 'scheduled_stale_cleanup_report'
    source = 'sentinel-agent-ops'
    severity = $severity
    summary = $summary
  }

  $webhookRes = Invoke-JsonRequest -Method 'POST' -Uri $effectiveWebhook -Headers @{ 'Content-Type' = 'application/json' } -Body $payload
  $webhookStatus = [pscustomobject]@{
    http = $webhookRes.StatusCode
    ok = $webhookRes.StatusCode -ge 200 -and $webhookRes.StatusCode -lt 300
    raw = $webhookRes.Raw
  }
}

[pscustomobject]@{
  summary = $summary
  apply_cleanup = $ApplyCleanup.IsPresent
  send_webhook = $SendWebhook.IsPresent
  webhook_status = $webhookStatus
} | ConvertTo-Json -Depth 12
