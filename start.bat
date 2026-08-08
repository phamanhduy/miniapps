@echo off
setlocal enabledelayedexpansion

title BrainOS Production Server

:: Only prepend local bin if it exists (using single-line IF to avoid parenthesis parsing bug)
if exist "%~dp0bin" set "PATH=%~dp0bin;%PATH%"

set NODE_ENV=production
set STORAGE_DIR=%~dp0server\storage

:: Get PORT from environment or .env
if "%PORT%"=="" (
    for /f "tokens=2 delims==" %%a in ('findstr "PORT=" "%~dp0.env"') do set PORT=%%a
)
if "%PORT%"=="" (
    set PORT=3001
)

:: Set SERVER_PORT for AnythingLLM backend
set SERVER_PORT=%PORT%

:: Check and install server dependencies
if not exist "%~dp0server\node_modules" goto install_server
goto check_collector

:install_server
echo [System] First time setup: Installing Server dependencies...
cd /d "%~dp0server"
where yarn >nul 2>nul
if !errorlevel! equ 0 (
    call yarn install --production
) else (
    where corepack >nul 2>nul
    if !errorlevel! equ 0 (
        call corepack yarn install --production
    ) else (
        call npx yarn install --production
    )
)
echo [System] Generating database client...
call npx prisma generate

:check_collector
:: Check and install collector dependencies
if not exist "%~dp0collector\node_modules" goto install_collector
goto start_app

:install_collector
echo [System] First time setup: Installing Collector dependencies...
cd /d "%~dp0collector"
where yarn >nul 2>nul
if !errorlevel! equ 0 (
    call yarn install --production
) else (
    where corepack >nul 2>nul
    if !errorlevel! equ 0 (
        call corepack yarn install --production
    ) else (
        call npx yarn install --production
    )
)

:start_app
:: Start Document Collector on port 8888 (running in background)
echo Starting Document Collector on port 8888...
cd /d "%~dp0"

:: Avoid putting %PATH% in parenthesized IF block
if exist "%~dp0bin" goto start_collector_local
start "AnythingLLM Collector" /B cmd /c "set NODE_ENV=production && cd collector && node index.js"
goto start_backend

:start_collector_local
start "AnythingLLM Collector" /B cmd /c "set "PATH=%~dp0bin;%PATH%" && set NODE_ENV=production && cd collector && node index.js"

:start_backend
:: Start Backend Server on port %SERVER_PORT%
echo Starting Backend Server on port %SERVER_PORT%...
cd /d "%~dp0server"
node index.js
