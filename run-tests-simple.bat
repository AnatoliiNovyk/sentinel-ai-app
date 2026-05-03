@echo off
cd /d d:\WORK\GITHUB\SENTINEL_AI\sentinel-ai-app
echo Killing old processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo Running Vitest...
npx vitest run --reporter=verbose 2>&1 | tee test-output.txt
echo.
echo Tests completed. Output saved to test-output.txt
pause