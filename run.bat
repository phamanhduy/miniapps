@echo off
title AnythingLLM Production Server
set PATH=%~dp0bin;%PATH%
set NODE_ENV=production
set STORAGE_DIR=%~dp0server\storage


rem Check and install server dependencies
if not exist "%~dp0server\node_modules" (
    echo [System] First time setup: Installing Server dependencies...
    cd /d "%~dp0server"
    call yarn install --production
    echo [System] Generating database client...
    call npx prisma generate
)

rem Check and install collector dependencies
if not exist "%~dp0collector\node_modules" (
    echo [System] First time setup: Installing Collector dependencies...
    cd /d "%~dp0collector"
    call yarn install --production
)

echo Starting Document Collector on port 8888...
cd /d "%~dp0"
start "AnythingLLM Collector" cmd /c "set PATH=%~dp0bin;%PATH% && set NODE_ENV=production && cd collector && node index.js"

echo Starting Backend Server on port 3001...
cd /d "%~dp0server"
node index.js
pause
