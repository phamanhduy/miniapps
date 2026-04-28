@echo off
setlocal enabledelayedexpansion
set "ROOT_PATH=%~dp0"
set "ROOT_PATH_NGINX=%ROOT_PATH:\=/%"
set "ROOT_PATH_NGINX=%ROOT_PATH_NGINX:~0,-1%"

:: Mac dinh cau hinh
set "PORT=4000"
set "DB_NAME=wordpress"

:: Doc file .env neu co
if exist "%ROOT_PATH%.env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%ROOT_PATH%.env") do (
        set "%%a=%%b"
    )
)

:: Thiet lap de PHP tu dong recycle sau 1000 requests de tranh memory leak
set PHP_FCGI_MAX_REQUESTS=1000

title Portable WordPress Controller (Active Monitoring)

echo =======================================================
echo    DANG KHOI DONG MOI TRUONG PORTABLE WORDPRESS
echo =======================================================
echo Thu muc goc: %ROOT_PATH%

:: Kiem tra va khoi phuc cac thanh phan bi thieu (tu dong bo qua neu da co du)
powershell -ExecutionPolicy Bypass -File "%ROOT_PATH%setup.ps1"

:: 0. Don dep cac tien trinh cu bi treo (neu co)
echo [INFO] Dang don dep tien trinh cu...
taskkill /f /im nginx.exe >nul 2>&1
taskkill /f /im php-cgi.exe >nul 2>&1
taskkill /f /im mysqld.exe >nul 2>&1

:: 1. Tu dong cap nhat file cau hinh Nginx voi duong dan thuc te
echo [INFO] Dang cau hinh duong dan he thong...
powershell -Command "(Get-Content '%ROOT_PATH%nginx\conf\nginx.conf.template') -replace '\{\{ROOT_PATH\}\}', '%ROOT_PATH_NGINX%' -replace '\{\{PORT\}\}', '%PORT%' | Set-Content '%ROOT_PATH%nginx\conf\nginx.conf'"

:: 2. Khoi tao Database neu chua co
if not exist "%ROOT_PATH%mysql\data\mysql" (
    echo [INFO] Dang khoi tao database lan dau...
    if not exist "%ROOT_PATH%mysql\data" mkdir "%ROOT_PATH%mysql\data"
    "%ROOT_PATH%mysql\bin\mariadb-install-db.exe" --datadir="%ROOT_PATH%mysql\data"
)

echo.
echo [1/3] Khoi dong MariaDB...
start "MariaDB" /b "%ROOT_PATH%mysql\bin\mysqld.exe" --defaults-file="%ROOT_PATH%mysql\my.ini" --datadir="%ROOT_PATH%mysql\data" --standalone

:: Cho 3 giay de MariaDB kip khoi dong
ping -n 4 127.0.0.1 > nul
"%ROOT_PATH%mysql\bin\mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS %DB_NAME% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >nul 2>&1

echo [2/3] Khoi dong PHP FastCGI (4 Workers)...
start "PHP9000" /b "%ROOT_PATH%php\php-cgi.exe" -b 127.0.0.1:9000
start "PHP9001" /b "%ROOT_PATH%php\php-cgi.exe" -b 127.0.0.1:9001
start "PHP9002" /b "%ROOT_PATH%php\php-cgi.exe" -b 127.0.0.1:9002
start "PHP9003" /b "%ROOT_PATH%php\php-cgi.exe" -b 127.0.0.1:9003

echo [3/3] Khoi dong Nginx...
pushd "%ROOT_PATH%nginx"
start "Nginx" /b "nginx.exe" -p "%ROOT_PATH%nginx"
popd

echo.
echo -------------------------------------------------------
echo THANH CONG! Server dang chay tai: http://localhost:%PORT%
echo -------------------------------------------------------
echo [CANH BAO] KHONG DUOC DONG CUA SO NAY!
echo Cua so nay dang theo doi de tu dong restart neu server bi sap.
echo -------------------------------------------------------
echo.

:MONITOR
if exist "%ROOT_PATH%stop.flag" (
    echo [%time%] [INFO] Nhan duoc lenh dung. Dang thoat watchdog...
    del "%ROOT_PATH%stop.flag" >nul 2>&1
    exit
)
:: Kiem tra MariaDB
tasklist /fi "imagename eq mysqld.exe" | find ":" > nul
if %errorlevel% equ 0 (
    echo [%time%] [!] MariaDB bi sap. Dang khoi dong lai...
    start "MariaDB" /b "%ROOT_PATH%mysql\bin\mysqld.exe" --defaults-file="%ROOT_PATH%mysql\my.ini" --datadir="%ROOT_PATH%mysql\data" --standalone
)

:: Kiem tra PHP (4 Workers qua Port)
netstat -anp TCP > "%ROOT_PATH%php_ports.txt"

find "127.0.0.1:9000" "%ROOT_PATH%php_ports.txt" | find "LISTENING" > nul
if %errorlevel% neq 0 (
    echo [%time%] [!] PHP Worker 9000 sap hoac dang recycle. Dang khoi dong lai...
    start "PHP9000" /b "%ROOT_PATH%php\php-cgi.exe" -b 127.0.0.1:9000
)

find "127.0.0.1:9001" "%ROOT_PATH%php_ports.txt" | find "LISTENING" > nul
if %errorlevel% neq 0 (
    echo [%time%] [!] PHP Worker 9001 sap hoac dang recycle. Dang khoi dong lai...
    start "PHP9001" /b "%ROOT_PATH%php\php-cgi.exe" -b 127.0.0.1:9001
)

find "127.0.0.1:9002" "%ROOT_PATH%php_ports.txt" | find "LISTENING" > nul
if %errorlevel% neq 0 (
    echo [%time%] [!] PHP Worker 9002 sap hoac dang recycle. Dang khoi dong lai...
    start "PHP9002" /b "%ROOT_PATH%php\php-cgi.exe" -b 127.0.0.1:9002
)

find "127.0.0.1:9003" "%ROOT_PATH%php_ports.txt" | find "LISTENING" > nul
if %errorlevel% neq 0 (
    echo [%time%] [!] PHP Worker 9003 sap hoac dang recycle. Dang khoi dong lai...
    start "PHP9003" /b "%ROOT_PATH%php\php-cgi.exe" -b 127.0.0.1:9003
)

del "%ROOT_PATH%php_ports.txt" > nul 2>&1

:: Kiem tra Nginx
tasklist /fi "imagename eq nginx.exe" | find ":" > nul
if %errorlevel% equ 0 (
    echo [%time%] [!] Nginx bi sap. Dang khoi dong lai...
    pushd "%ROOT_PATH%nginx"
    start "Nginx" /b "nginx.exe" -p "%ROOT_PATH%nginx"
    popd
)

:: Cho 10 giay truoc khi kiem tra lai
ping -n 11 127.0.0.1 > nul
goto MONITOR
