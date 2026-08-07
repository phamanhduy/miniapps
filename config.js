const path = require('path');
const fs = require('fs');

const APP_DIR = __dirname;
const ENV_FILE = path.join(APP_DIR, '.env');
const DATA_DIR = path.join(APP_DIR, 'data');
const ENGINE_USER_FOLDER = path.join(DATA_DIR, 'Engine_Data');
const SYSTEM_PREFIX_FOLDER = path.join(DATA_DIR, 'System');
const CACHE_FOLDER = path.join(DATA_DIR, 'Cache');

// 1. Đọc Port từ file .env độc lập trong thư mục app
function getAppPort() {
    if (fs.existsSync(ENV_FILE)) {
        const content = fs.readFileSync(ENV_FILE, 'utf8');
        const match = content.match(/^PORT=(\d+)/m);
        if (match) return parseInt(match[1], 10);
    }
    return 5678;
}

// 2. Đảm bảo các thư mục dữ liệu cục bộ của app tồn tại
function ensureAppFolders() {
    [DATA_DIR, ENGINE_USER_FOLDER, SYSTEM_PREFIX_FOLDER, CACHE_FOLDER].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
    const pkgPath = path.join(ENGINE_USER_FOLDER, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        fs.writeFileSync(pkgPath, JSON.stringify({ "name": "n8n-miniapp", "version": "1.0.0" }, null, 2));
    }
}

// 3. Tìm Node.js binary từ thư mục gốc dự án hoặc hệ thống
function getNodePath() {
    const rootDir = path.resolve(APP_DIR, '..', '..');
    const possibleNode = path.join(rootDir, 'bin', 'node', 'node.exe');
    if (fs.existsSync(possibleNode)) {
        return { nodePath: possibleNode, nodeBinDir: path.join(rootDir, 'bin', 'node') };
    }
    return { nodePath: process.execPath || 'node', nodeBinDir: path.dirname(process.execPath || '') };
}

module.exports = {
    APP_DIR,
    ENV_FILE,
    DATA_DIR,
    ENGINE_USER_FOLDER,
    SYSTEM_PREFIX_FOLDER,
    CACHE_FOLDER,
    getAppPort,
    ensureAppFolders,
    getNodePath
};
