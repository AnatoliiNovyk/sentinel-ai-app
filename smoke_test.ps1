$envFile = "sentinel-agent/.env"
$lines = Get-Content $envFile
$supabaseUrl = ($lines | Select-String "SUPABASE_URL=").ToString().Split("=", 2)[1].Trim().Trim('"')
$supabaseKey = ($lines | Select-String "SUPABASE_SERVICE_ROLE_KEY=").ToString().Split("=", 2)[1].Trim().Trim('"')
$agentSecret = ($lines | Select-String "AGENT_SECRET=").ToString().Split("=", 2)[1].Trim().Trim('"')

$headers = @{
    "apikey" = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
    "Content-Type" = "application/json"
}

# 2) Fetch one project
$projects = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/projects?select=id,user_id,org_id,target&limit=1" -Headers $headers -Method Get
$project = $projects[0]
Write-Host "Fetched Project: $($project.id)"

# 3) Insert valid scan row
$scanBody = @{
    project_id = $project.id
    user_id = $project.user_id
    org_id = $project.org_id
    scanner = "nuclei"
    status = "pending"
    is_mock = $false
    detected_mode = "passive"
}
$scanHeaders = $headers.Clone()
$scanHeaders["Prefer"] = "return=representation"

try {
    $scanResponse = Invoke-WebRequest -Uri "$supabaseUrl/rest/v1/scans" -Headers $scanHeaders -Method Post -Body ($scanBody | ConvertTo-Json)
    $scan = $scanResponse.Content | ConvertFrom-Json
    $scanId = $scan[0].id
    Write-Host "Created Scan: $scanId"
} catch {
    Write-Host "Error creating scan"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Error Body: $($reader.ReadToEnd())"
    }
    throw $_
}

# 4) Call scan-dispatch
$dispatchBody = @{
    scan_id = $scanId
    project_id = $project.id
    scanner = "nuclei"
    target = if ($project.target) { $project.target } else { "127.0.0.1" }
    org_id = $project.org_id
}
$dispatchResponse = Invoke-WebRequest -Uri "$supabaseUrl/functions/v1/scan-dispatch" -Headers $headers -Method Post -Body ($dispatchBody | ConvertTo-Json) -SkipHttpErrorCheck

# 5) Call scan-result
$resultHeaders = @{
    "apikey" = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
    "Content-Type" = "application/json"
    "X-Agent-Secret" = $agentSecret
}
$resultBody = @{
    job_id = ($dispatchResponse.Content | ConvertFrom-Json).job_id
    scan_id = $scanId
    user_id = $project.user_id
    project_id = $project.id
    error_message = "smoke controlled failure"
}
$resultResponse = Invoke-WebRequest -Uri "$supabaseUrl/functions/v1/scan-result" -Headers $resultHeaders -Method Post -Body ($resultBody | ConvertTo-Json) -SkipHttpErrorCheck

# 6) Query agent_logs
Start-Sleep -Seconds 3
$logs = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/agent_logs?scan_id=eq.$scanId&select=level,message,created_at&order=created_at.asc" -Headers $headers -Method Get

# Output results
Write-Host "--- RESULTS ---"
Write-Host "scan_id: $scanId"
Write-Host "dispatch status: $($dispatchResponse.StatusCode) body: $($dispatchResponse.Content)"
Write-Host "result status: $($resultResponse.StatusCode) body: $($resultResponse.Content)"
Write-Host "log count: $($logs.Count)"
if ($logs.Count -gt 0) {
    $logs | ForEach-Object { Write-Host "[$($_.created_at)] [$($_.level)] $($_.message)" }
}
