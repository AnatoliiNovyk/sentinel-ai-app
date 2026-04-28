param(
  [string]$EnvFile = "sentinel-agent/.env",
  [int]$TimeoutMinutes = 15,
  [int]$MaxScans = 50,
  [switch]$ApplyCleanup
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

  $jsonBody = if ($null -ne $Body) { $Body | ConvertTo-Json -Depth 8 } else { $null }

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

if ($MaxScans -lt 1) {
  throw "MaxScans must be >= 1"
}

$content = Get-Content $EnvFile -Raw
$supabaseUrl = Get-EnvValue -Content $content -Key 'SUPABASE_URL'
$supabaseServiceRoleKey = Get-EnvValue -Content $content -Key 'SUPABASE_SERVICE_ROLE_KEY'

$restHeaders = @{
  'apikey' = $supabaseServiceRoleKey
  'Authorization' = "Bearer $supabaseServiceRoleKey"
  'Content-Type' = 'application/json'
}

$cutoffIso = (Get-Date).ToUniversalTime().AddMinutes(-1 * $TimeoutMinutes).ToString('o')

$runningJobsUri = "$supabaseUrl/rest/v1/scan_jobs?select=id,scan_id,status,started_at,error_message&status=eq.running&started_at=lt.$([System.Uri]::EscapeDataString($cutoffIso))&order=started_at.asc&limit=$MaxScans"
$runningJobsRes = Invoke-JsonRequest -Method 'GET' -Uri $runningJobsUri -Headers $restHeaders -Body $null
if ($runningJobsRes.StatusCode -ne 200) {
  throw "Failed to fetch stale running jobs. HTTP=$($runningJobsRes.StatusCode) Body=$($runningJobsRes.Raw)"
}

$runningJobs = @()
if ($runningJobsRes.Json) {
  $runningJobs = @($runningJobsRes.Json)
}

$scanIds = @($runningJobs | Where-Object { $_.scan_id } | ForEach-Object { $_.scan_id } | Select-Object -Unique)
$scanStates = @()
if ($scanIds.Count -gt 0) {
  $filters = ($scanIds | ForEach-Object { 'id.eq.' + $_ }) -join ','
  $scansUri = "$supabaseUrl/rest/v1/scans?select=id,status,started_at,completed_at&or=($([System.Uri]::EscapeDataString($filters)))"
  $scansRes = Invoke-JsonRequest -Method 'GET' -Uri $scansUri -Headers $restHeaders -Body $null
  if ($scansRes.StatusCode -eq 200 -and $scansRes.Json) {
    $scanStates = @($scansRes.Json)
  }
}

$cleanupRes = $null
if ($ApplyCleanup) {
  $cleanupRes = Invoke-JsonRequest -Method 'POST' -Uri "$supabaseUrl/rest/v1/rpc/cleanup_stale_running_jobs" -Headers $restHeaders -Body @{ timeout_minutes = $TimeoutMinutes }
}

[pscustomobject]@{
  cutoff_iso = $cutoffIso
  timeout_minutes = $TimeoutMinutes
  max_scans = $MaxScans
  apply_cleanup = $ApplyCleanup.IsPresent
  stale_running_jobs_count = $runningJobs.Count
  stale_running_jobs = $runningJobs
  affected_scans_count = $scanStates.Count
  affected_scans = $scanStates
  cleanup_http = if ($cleanupRes) { $cleanupRes.StatusCode } else { $null }
  cleanup_body = if ($cleanupRes) { $cleanupRes.Raw } else { $null }
} | ConvertTo-Json -Depth 8
