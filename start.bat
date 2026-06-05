@echo off
title AI Campus OS - Local Server
cd /d "%~dp0"
echo ==============================================
echo    Starting AI Campus OS
echo ==============================================
echo.
if not exist "node_modules" (
  echo First-time setup: installing libraries...
  echo This can take a minute. Please wait.
  echo.
  call npm install
  echo.
)
echo Your browser will open at http://localhost:3000 shortly.
echo Keep this window OPEN while using the app.
echo To stop the app: press Ctrl+C, then close this window.
echo.
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"
call npm run dev
echo.
echo The server has stopped. Press any key to close.
pause >nul
