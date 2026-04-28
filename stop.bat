@echo off
title Stop Portable WordPress
echo =======================================================
echo    DANG DONG CAC DICH VU WORDPRESS...
echo =======================================================

:: Tao co dung de bao cho start.bat thoat
echo off > "%ROOT_PATH%stop.flag"

echo Dang dung Watchdog (start.bat)...
taskkill /f /fi "WINDOWTITLE eq Portable WordPress Controller (Active Monitoring)" >nul 2>&1
wmic process where "CommandLine like '%%start.bat%%' and Name='cmd.exe'" call terminate >nul 2>&1

echo Dang tat Nginx...
taskkill /f /im nginx.exe >nul 2>&1

echo Dang tat PHP...
taskkill /f /im php-cgi.exe >nul 2>&1

echo Dang tat MariaDB...
taskkill /f /im mysqld.exe >nul 2>&1

echo.
echo Da dong tat ca dich vu an toan.
echo Tam biet!
timeout /t 3
