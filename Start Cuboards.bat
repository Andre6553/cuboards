@echo off
title Cuboards
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo.
  echo  Node.js is not installed.
  echo  Please install from https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
)

echo Building Cuboards...
call npm run build
if %errorlevel% neq 0 (
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Starting Cuboards at http://localhost:5199
echo Press Ctrl+C to stop.
echo.
start "" "http://localhost:5199"
call npm run preview
