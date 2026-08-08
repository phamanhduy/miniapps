@echo off
setlocal enabledelayedexpansion

:: Get PORT from .env
for /f "tokens=2 delims==" %%a in ('findstr "PORT=" "%~dp0.env"') do set PORT=%%a

if "%PORT%"=="" (
    echo No PORT found in .env, using default 3001
    set PORT=3001
)

echo Closing backend port %PORT%...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%PORT% ^| findstr LISTENING') do (
    taskkill /F /PID %%a
)

echo Closing collector port 8888...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8888 ^| findstr LISTENING') do (
    taskkill /F /PID %%a
)

echo Done.
pause
