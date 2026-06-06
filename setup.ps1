$ProgressPreference = 'SilentlyContinue'
$root = $PSScriptRoot

Write-Host "--- Don dep tien trinh cu truoc khi cai dat..." -ForegroundColor Yellow
Stop-Process -Name "nginx", "php-cgi", "mysqld" -Force -ErrorAction SilentlyContinue

function Download-And-Extract {
    param($url, $destFolder, $subFolderToMove = $null)
    $zipFile = Join-Path $root "temp.zip"
    $targetPath = Join-Path $root $destFolder
    
    if (-not (Test-Path $targetPath)) { New-Item -ItemType Directory -Path $targetPath | Out-Null }
    
    Write-Host "--- Dang tai tu $url ..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $url -OutFile $zipFile
    
    Write-Host "--- Dang giai nen vao $destFolder ..." -ForegroundColor Yellow
    Expand-Archive -Path $zipFile -DestinationPath $targetPath -Force
    
    if ($subFolderToMove) {
        $extractedPath = Get-ChildItem -Path $targetPath -Directory | Where-Object { $_.Name -like "$subFolderToMove*" } | Select-Object -First 1
        if ($extractedPath) {
            Copy-Item -Path "$($extractedPath.FullName)\*" -Destination $targetPath -Recurse -Force
            Remove-Item -Path $extractedPath.FullName -Recurse -Force
        }
    }
    
    Remove-Item $zipFile -Force
}

# 1. Tai Nginx
if (-not (Test-Path (Join-Path $root "nginx\nginx.exe"))) {
    Download-And-Extract "https://nginx.org/download/nginx-1.24.0.zip" "nginx" "nginx-1.24.0"
}

# 2. Tai PHP
if (-not (Test-Path (Join-Path $root "php\php-cgi.exe"))) {
    Download-And-Extract "https://windows.php.net/downloads/releases/archives/php-8.2.12-Win32-vs16-x64.zip" "php"
}

# 3. Tai MariaDB
if (-not (Test-Path (Join-Path $root "mysql\bin\mysqld.exe"))) {
    Download-And-Extract "https://archive.mariadb.org/mariadb-10.11.5/winx64-packages/mariadb-10.11.5-winx64.zip" "mysql" "mariadb-10.11.5"
}

# 4. Thiet lap file cau hinh va thu muc root
Write-Host "--- Thiet lap file cau hinh va thu muc www ..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $root "www"))) { New-Item -ItemType Directory -Path (Join-Path $root "www") | Out-Null }
if (Test-Path (Join-Path $root "nginx.conf.template")) { Copy-Item -Path (Join-Path $root "nginx.conf.template") -Destination (Join-Path $root "nginx\conf\") -Force }
if (Test-Path (Join-Path $root "my.ini")) { Copy-Item -Path (Join-Path $root "my.ini") -Destination (Join-Path $root "mysql\") -Force }

# Tao va cau hinh php.ini cho WordPress
$phpIni = Join-Path $root "php\php.ini"
$phpIniDev = Join-Path $root "php\php.ini-development"
if (Test-Path $phpIniDev) {
    Copy-Item $phpIniDev $phpIni -Force
    (Get-Content $phpIni) -replace ';extension_dir = "ext"', 'extension_dir = "ext"' -replace ';extension=mysqli', 'extension=mysqli' -replace ';extension=mbstring', 'extension=mbstring' -replace ';extension=curl', 'extension=curl' -replace ';extension=gd', 'extension=gd' -replace ';extension=zip', 'extension=zip' | Set-Content $phpIni
}

# 5. Tai va thiet lap WordPress
if (-not (Test-Path (Join-Path $root "www\wp-config-sample.php"))) {
    Download-And-Extract "https://wordpress.org/latest.zip" "www" "wordpress"
}

$wpConfig = Join-Path $root "www\wp-config.php"
$wpSample = Join-Path $root "www\wp-config-sample.php"
if ((Test-Path $wpSample) -and -not (Test-Path $wpConfig)) {
    Write-Host "--- Tu dong tao file wp-config.php tu .env ..." -ForegroundColor Yellow
    
    $DB_NAME = "wordpress"; $DB_USER = "root"; $DB_PASS = ""
    $envFile = Join-Path $root ".env"
    if (Test-Path $envFile) {
        Get-Content $envFile | Where-Object { $_ -match "^([^#\s]+?)=(.*)$" } | ForEach-Object {
            Set-Variable -Name $Matches[1] -Value $Matches[2]
        }
    }
    
    (Get-Content $wpSample) -replace 'database_name_here', $DB_NAME -replace 'username_here', $DB_USER -replace 'password_here', $DB_PASS | Set-Content $wpConfig

    Write-Host "--- Them cau hinh Proxy va Cloudflare Tunnel vao wp-config.php ..." -ForegroundColor Yellow
    $proxyConfig = @'
/* --- Cấu hình hỗ trợ Proxy và Cloudflare Tunnel --- */
// 1. Nhận diện giao thức HTTPS từ Proxy
if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
    $_SERVER['HTTPS'] = 'on';
}
// 2. Tự động cấu hình URL động khi truy cập qua Domain ngoài
if (isset($_SERVER['HTTP_HOST'])) {
    $http_host = $_SERVER['HTTP_HOST'];
    $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https://' : 'http://';
    
    // Nếu truy cập từ domain ngoài (không chứa localhost / 127.0.0.1)
    if (strpos($http_host, 'localhost') === false && strpos($http_host, '127.0.0.1') === false) {
        define('WP_HOME', $protocol . $http_host);
        define('WP_SITEURL', $protocol . $http_host);
    }
}

require_once ABSPATH . 'wp-settings.php';
'@
    (Get-Content $wpConfig) -replace "require_once ABSPATH \. 'wp-settings\.php';", $proxyConfig | Set-Content $wpConfig
}

Write-Host "`n=== HOAN TAT THIET LAP! ===" -ForegroundColor Green
Write-Host "Bay gio ban co the chay file start.bat de bat dau." -ForegroundColor White
