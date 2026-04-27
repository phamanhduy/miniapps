@echo off
SET NODE_ENV=production
echo Starting ZaloCRM (Single Bundle Mode)...
node --env-file="%~dp0.env" dist/index.js
pause
