param(
    [switch]$Rebuild
)

$ErrorActionPreference = 'Stop'

$AgentRoot = Split-Path -Parent $PSScriptRoot
Set-Location $AgentRoot

$DistEntry = Join-Path $AgentRoot 'dist\index.js'
$LogDir = Join-Path $AgentRoot 'logs'
$OutLog = Join-Path $LogDir 'agent.out.log'
$ErrLog = Join-Path $LogDir 'agent.err.log'

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

if ($Rebuild -or -not (Test-Path $DistEntry)) {
    npm run build
}

$existing = Get-CimInstance Win32_Process |
    Where-Object {
        $_.Name -eq 'node.exe' -and
        $_.CommandLine -like '*sentinel-agent*dist\\index.js*'
    }

if ($existing) {
    Write-Host 'Sentinel Agent already running.'
    exit 0
}

Start-Process -FilePath 'node' \
    -ArgumentList '-r', 'dotenv/config', 'dist/index.js' \
    -WorkingDirectory $AgentRoot \
    -WindowStyle Hidden \
    -RedirectStandardOutput $OutLog \
    -RedirectStandardError $ErrLog

Write-Host 'Sentinel Agent started.'
