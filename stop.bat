@echo off
setlocal enabledelayedexpansion

:: Get PORT from .env
for /f "tokens=2 delims==" %%a in ('findstr "PORT=" .env') do set PORT=%%a

if "%PORT%"=="" (
    echo No PORT found in .env
    pause
    exit /b
)

echo Closing port %PORT%...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%PORT% ^| findstr LISTENING') do (
    taskkill /F /PID %%a
)

echo Done.
