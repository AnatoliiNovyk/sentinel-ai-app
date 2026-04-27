$ErrorActionPreference = 'Stop'

$procs = Get-CimInstance Win32_Process |
    Where-Object {
        $_.Name -eq 'node.exe' -and
        $_.CommandLine -like '*sentinel-agent*dist\\index.js*'
    }

if (-not $procs) {
    Write-Host 'Sentinel Agent is not running.'
    exit 0
}

foreach ($p in $procs) {
    Stop-Process -Id $p.ProcessId -Force
}

Write-Host ('Stopped process(es): ' + (($procs | Select-Object -ExpandProperty ProcessId) -join ', '))
