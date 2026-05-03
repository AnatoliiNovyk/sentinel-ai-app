# Run Vitest tests
cd $PSScriptRoot
npx vitest run --reporter=verbose 2>&1 | Tee-Object -FilePath "test-results.txt"
Write-Output "Tests completed. Results saved to test-results.txt"
Get-Content "test-results.txt" -TotalCount 50
