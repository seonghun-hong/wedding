@echo off
cd /d "%~dp0"

echo Wedding local server
echo ====================
echo.

if not exist node_modules (
  echo Installing dependencies...
  call npm ci --cache .npm-cache
  if errorlevel 1 (
    echo.
    echo Dependency install failed.
    pause
    exit /b 1
  )
)

echo.
echo Keep this window open while checking the invitation.
echo Open this address in your browser:
echo http://127.0.0.1:5173/wedding/
echo.
echo Starting server...
echo.

npm run dev -- --host 127.0.0.1 --port 5173 --force

echo.
echo Server stopped.
pause
