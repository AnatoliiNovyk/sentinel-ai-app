@echo off
taskkill /F /IM node.exe 2>nul
taskkill /F /IM npm.exe 2>nul
taskkill /F /IM vitest.exe 2>nul
echo All node/npm processes killed
