param(
  [string]$EnvFile = "sentinel-agent/.env",
  [switch]$ControlledFailure
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

$content = Get-Content $EnvFile -Raw
$supabaseUrl = Get-EnvValue -Content $content -Key 'SUPABASE_URL'
$supabaseServiceRoleKey = Get-EnvValue -Content $content -Key 'SUPABASE_SERVICE_ROLE_KEY'
$agentSecret = Get-EnvValue -Content $content -Key 'AGENT_SECRET'

$restHeaders = @{
  'apikey' = $supabaseServiceRoleKey
  'Authorization' = "Bearer $supabaseServiceRoleKey"
  'Content-Type' = 'application/json'
}

$projectsRes = Invoke-JsonRequest -Method 'GET' -Uri "$supabaseUrl/rest/v1/projects?select=id,user_id,org_id,target&limit=1" -Headers $restHeaders -Body $null
if ($projectsRes.StatusCode -ne 200 -or -not $projectsRes.Json -or $projectsRes.Json.Count -eq 0) {
  throw "Failed to fetch project for smoke run. HTTP=$($projectsRes.StatusCode) Body=$($projectsRes.Raw)"
}

$project = $projectsRes.Json[0]
$target = if ([string]::IsNullOrWhiteSpace($project.target)) { '127.0.0.1' } else { $project.target }

$scanHeaders = $restHeaders.Clone()
$scanHeaders['Prefer'] = 'return=representation'

$scanBody = @{
  project_id = $project.id
  user_id = $project.user_id
  org_id = $project.org_id
  scanner = 'smoke-pipeline'
  status = 'queued'
  is_mock = $false
  detected_mode = 'UNKNOWN'
  started_at = (Get-Date).ToUniversalTime().ToString('o')
}

$scanRes = Invoke-JsonRequest -Method 'POST' -Uri "$supabaseUrl/rest/v1/scans" -Headers $scanHeaders -Body $scanBody
if ($scanRes.StatusCode -lt 200 -or $scanRes.StatusCode -ge 300 -or -not $scanRes.Json -or $scanRes.Json.Count -eq 0) {
  throw "Failed to create scan row. HTTP=$($scanRes.StatusCode) Body=$($scanRes.Raw)"
}

$scanId = $scanRes.Json[0].id

$dispatchBody = @{
  scan_id = $scanId
  project_id = $project.id
  scanner = 'smoke-pipeline'
  target = $target
  org_id = $project.org_id
}

$dispatchRes = Invoke-JsonRequest -Method 'POST' -Uri "$supabaseUrl/functions/v1/scan-dispatch" -Headers $restHeaders -Body $dispatchBody

$resultRes = $null
if ($ControlledFailure) {
  $jobId = $null
  if ($dispatchRes.Json -and $dispatchRes.Json.job_id) {
    $jobId = [string]$dispatchRes.Json.job_id
  } else {
    $jobId = [guid]::NewGuid().ToString()
  }

  $resultHeaders = $restHeaders.Clone()
  $resultHeaders['X-Agent-Secret'] = $agentSecret

  $resultBody = @{
    job_id = $jobId
    scan_id = $scanId
    user_id = $project.user_id
    project_id = $project.id
    error_message = 'smoke controlled failure'
  }

  $resultRes = Invoke-JsonRequest -Method 'POST' -Uri "$supabaseUrl/functions/v1/scan-result" -Headers $resultHeaders -Body $resultBody
}

Start-Sleep -Seconds 2
$logsRes = Invoke-JsonRequest -Method 'GET' -Uri "$supabaseUrl/rest/v1/agent_logs?scan_id=eq.$scanId&select=level,message,created_at&order=created_at.asc" -Headers $restHeaders -Body $null
$logs = @()
if ($logsRes.StatusCode -eq 200 -and $logsRes.Json) {
  $logs = @($logsRes.Json)
}

[pscustomobject]@{
  scan_id = $scanId
  dispatch_http = $dispatchRes.StatusCode
  dispatch_body = $dispatchRes.Raw
  result_http = if ($resultRes) { $resultRes.StatusCode } else { $null }
  result_body = if ($resultRes) { $resultRes.Raw } else { $null }
  log_count = $logs.Count
  logs = $logs | ForEach-Object { "$(($_.created_at)) [$($_.level)] $($_.message)" }
} | ConvertTo-Json -Depth 8
