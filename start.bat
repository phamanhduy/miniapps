@echo off
setlocal enabledelayedexpansion

title BrainOS Production Server

:: Only prepend local bin if it exists
if exist "%~dp0bin" (
    set PATH=%~dp0bin;%PATH%
)

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
if not exist "%~dp0server\node_modules" (
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
)

:: Check and install collector dependencies
if not exist "%~dp0collector\node_modules" (
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
)

:: Start Document Collector on port 8888 (running in background)
echo Starting Document Collector on port 8888...
cd /d "%~dp0"
if exist "%~dp0bin" (
    start "AnythingLLM Collector" /B cmd /c "set PATH=%~dp0bin;%PATH% && set NODE_ENV=production && cd collector && node index.js"
) else (
    start "AnythingLLM Collector" /B cmd /c "set NODE_ENV=production && cd collector && node index.js"
)

:: Start Backend Server on port %SERVER_PORT%
echo Starting Backend Server on port %SERVER_PORT%...
cd /d "%~dp0server"
node index.js
