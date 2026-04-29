param(
  [string]$EnvFile = "sentinel-agent/.env",
  [string]$ProbeUrl = "",
  [int]$TimeoutSeconds = 10,
  [switch]$RequireReachable
)

$ErrorActionPreference = 'Stop'

function Get-EnvValue {
  param(
    [string]$Content,
    [string]$Key,
    [switch]$Optional
  )

  $match = [regex]::Match($Content, "(?m)^$Key\s*=\s*(.+)$")
  if (-not $match.Success) {
    if ($Optional) {
      return ''
    }
    throw "Missing required key in env file: $Key"
  }

  return $match.Groups[1].Value.Trim().Trim('"').Trim("'")
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers,
    [object]$Body,
    [int]$TimeoutSec
  )

  $jsonBody = if ($null -ne $Body) { $Body | ConvertTo-Json -Depth 8 } else { $null }

  try {
    $resp = Invoke-WebRequest -Method $Method -Uri $Uri -Headers $Headers -Body $jsonBody -UseBasicParsing -TimeoutSec $TimeoutSec
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

if ($TimeoutSeconds -lt 1 -or $TimeoutSeconds -gt 60) {
  throw "TimeoutSeconds must be in range 1..60"
}

$content = Get-Content $EnvFile -Raw
$supabaseUrl = Get-EnvValue -Content $content -Key 'SUPABASE_URL'
$supabaseServiceRoleKey = Get-EnvValue -Content $content -Key 'SUPABASE_SERVICE_ROLE_KEY'
$configuredProbeUrl = Get-EnvValue -Content $content -Key 'AGENT_HEALTH_URL' -Optional

$targetProbeUrl = if (-not [string]::IsNullOrWhiteSpace($ProbeUrl)) {
  $ProbeUrl.Trim()
} else {
  $configuredProbeUrl
}

if ([string]::IsNullOrWhiteSpace($targetProbeUrl)) {
  throw 'Agent health probe URL is missing. Set AGENT_HEALTH_URL in env or pass -ProbeUrl.'
}

$headers = @{
  'apikey' = $supabaseServiceRoleKey
  'Authorization' = "Bearer $supabaseServiceRoleKey"
  'Content-Type' = 'application/json'
}

$body = @{
  action = 'agent_health_probe'
  url = $targetProbeUrl
}

$requestUri = "$supabaseUrl/functions/v1/ai-gateway"
$response = Invoke-JsonRequest -Method 'POST' -Uri $requestUri -Headers $headers -Body $body -TimeoutSec $TimeoutSeconds

if ($response.StatusCode -ne 200) {
  throw "Gateway probe request failed. HTTP=$($response.StatusCode) Body=$($response.Raw)"
}

if (-not $response.Json) {
  throw 'Gateway probe returned empty JSON payload.'
}

$reachable = [bool]$response.Json.reachable
$probeHttpStatus = if ($null -ne $response.Json.http_status) { [int]$response.Json.http_status } else { $null }
$probeError = if ($null -ne $response.Json.error) { [string]$response.Json.error } else { $null }

if ($RequireReachable -and -not $reachable) {
  throw "Agent probe reachable=false. http_status=$probeHttpStatus error=$probeError"
}

[pscustomobject]@{
  schema_version = '1.0'
  report_type = 'agent_health_probe_smoke'
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
  gateway_http = $response.StatusCode
  request_id = $response.Json.request_id
  action = $response.Json.action
  status = $response.Json.status
  reachable = $reachable
  http_status = $probeHttpStatus
  error = $probeError
  probed_url = $response.Json.probed_url
  timeout_seconds = $TimeoutSeconds
  require_reachable = $RequireReachable.IsPresent
} | ConvertTo-Json -Depth 8