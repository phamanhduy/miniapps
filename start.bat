@echo off
setlocal enabledelayedexpansion
title Chatto Server
cd /d "%~dp0"

:: Doc bien tu file .env
set "PORT=4000"
set "APP_NAME=Chatto"
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        set "line=%%a"
        if not "!line:~0,1!"=="#" if not "!line!"=="" (
            set "%%a=%%b"
        )
    )
)

:: Truyen PORT va URL vao Chatto qua bien moi truong
set "CHATTO_WEBSERVER_PORT=!PORT!"
if "!CHATTO_WEBSERVER_URL!"=="" set "CHATTO_WEBSERVER_URL=http://localhost:!PORT!"

echo ============================================================
echo   !APP_NAME! SERVER
echo ============================================================
echo   Dia chi truy cap: !CHATTO_WEBSERVER_URL!
echo   Tai khoan mac dinh:
echo     Alice - login: alice / password: foobar123 (Owner)
echo     Bob   - login: bob   / password: foobar123
echo   (Doi port: sua file .env > dong PORT=xxxx)
echo ============================================================
echo.
chatto.exe run --config chatto.toml
pause
