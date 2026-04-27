param(
  [ValidateSet('dashboard', 'trio', 'full')]
  [string]$Suite = 'trio'
)

$ErrorActionPreference = 'Stop'

$scriptMap = @{
  dashboard = 'test:dashboard:stable'
  trio      = 'test:trio:stable'
  full      = 'test:full:stability:heap'
}

$target = $scriptMap[$Suite]

Write-Host "[test-safe] Running suite '$Suite' via npm script '$target'..." -ForegroundColor Cyan

npm run $target
if ($LASTEXITCODE -ne 0) {
  Write-Error "[test-safe] Suite '$Suite' failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

Write-Host "[test-safe] Suite '$Suite' passed." -ForegroundColor Green
