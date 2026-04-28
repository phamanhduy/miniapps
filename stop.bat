@echo off
title Stop Portable WordPress
echo =======================================================
echo    DANG DONG CAC DICH VU WORDPRESS...
echo =======================================================

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
