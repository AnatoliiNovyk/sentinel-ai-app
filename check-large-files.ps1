# Find large files (>400 lines) in src/
cd $PSScriptRoot
Write-Output "=== Finding large files (>400 lines) ==="
Get-ChildItem -Path "src" -Recurse -Include "*.tsx","*.ts" -File | ForEach-Object {
    $lines = (Get-Content $_.FullName).Count
    if ($lines -gt 400) {
        Write-Output "$($_.FullName) - $lines lines"
    }
} | Sort-Object -Descending -Property @{Expression={[int]($_.Split('-')[-1].Trim().Split(' ')[0])}}

Write-Output "`n=== Done ==="