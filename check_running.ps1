$envFile = "sentinel-agent/.env"
$config = @{}
Get-Content $envFile | Where-Object { $_ -match "=" } | ForEach-Object {
    $key, $value = $_ -split "=", 2
    $config[$key.Trim()] = $value.Trim().Trim('"').Trim("'")
}

$url = $config["SUPABASE_URL"]
if ($url -and -not $url.StartsWith("http")) { $url = "https://$url" }
$key = $config["SUPABASE_SERVICE_ROLE_KEY"]

$headers = @{ "apikey" = $key; "Authorization" = "Bearer $key" }

$scans = Invoke-RestMethod -Uri "$url/rest/v1/scans?status=eq.running&select=id,project_id,scanner,started_at,created_at&order=started_at.asc" -Headers $headers
$jobs = Invoke-RestMethod -Uri "$url/rest/v1/scan_jobs?status=eq.running&select=id,scan_id,project_id,scanner,started_at,created_at&order=started_at.asc" -Headers $headers

$now = [DateTime]::UtcNow
$results = @()

foreach ($item in ($scans + $jobs)) {
    $timeStr = if ($item.started_at) { $item.started_at } else { $item.created_at }
    if (-not $timeStr) { continue }
    
    try {
        $start = [DateTime]::Parse($timeStr, [System.Globalization.CultureInfo]::InvariantCulture)
    } catch {
        try { $start = Get-Date $timeStr } catch { continue }
    }
    
    $age = [Math]::Round(($now - $start.ToUniversalTime()).TotalMinutes, 1)
    if ($age -gt 60) {
        $type = if ($item.PSObject.Properties['scan_id']) { "Job" } else { "Scan" }
        $results += [PSCustomObject]@{ Type=$type; ID=$item.id; Project=$item.project_id; Scanner=$item.scanner; AgeMin=$age }
    }
}

if ($results.Count -gt 0) { $results | Format-Table -AutoSize } else { Write-Host "No rows older than 60 minutes." }
