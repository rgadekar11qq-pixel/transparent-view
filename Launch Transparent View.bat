@echo off
title Transparent View
cd /d "%~dp0"

echo ===================================================
echo             Starting Transparent View
echo ===================================================

:: Check if server is already running on port 3000
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo Server is already active on http://127.0.0.1:3000/
) else (
    echo Launching development server...
    start /b "" npm run dev
    timeout /t 2 /nobreak >nul
)

:: Try opening in dedicated app mode with Chrome or Edge, fallback to default browser
where msedge >nul 2>&1
if %errorlevel% equ 0 (
    start msedge --app=http://127.0.0.1:3000/
    goto done
)

where chrome >nul 2>&1
if %errorlevel% equ 0 (
    start chrome --app=http://127.0.0.1:3000/
    goto done
)

start http://127.0.0.1:3000/

:done
echo Transparent View is running!
exit
