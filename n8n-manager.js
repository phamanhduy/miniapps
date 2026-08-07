const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const net = require('net');
const appConfig = require('./config');

let engineProcess = null;
let engineStatus = 'stopped';
let engineLogs = [];

const port = appConfig.getAppPort();
appConfig.ensureAppFolders();

const LOG_FILE = path.join(appConfig.DATA_DIR, 'run.log');

const sendStatus = () => {
    if (global.io) {
        global.io.emit('mini-app:status:n8n', engineStatus);
    }
};

const sendLog = (message, type = 'info') => {
    const logEntry = {
        message: message.toString().trim(),
        type: (message.toString().toLowerCase().includes('error')) ? 'error' : type,
        timestamp: new Date().toLocaleTimeString()
    };
    engineLogs.push(logEntry);
    if (engineLogs.length > 500) engineLogs.shift();

    try {
        if (!fs.existsSync(path.dirname(LOG_FILE))) {
            fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
        }
        fs.appendFileSync(LOG_FILE, `[${logEntry.timestamp}] [${logEntry.type.toUpperCase()}] ${logEntry.message}\n`, 'utf8');
    } catch (e) { }

    if (global.io) {
        global.io.emit('mini-app:log:n8n', logEntry.message);
    }
};

const checkPort = () => {
    return new Promise((resolve) => {
        const client = net.createConnection({ port, host: '127.0.0.1' }, () => {
            client.destroy();
            resolve(true);
        });
        client.on('error', () => resolve(false));
        client.setTimeout(1000, () => {
            client.destroy();
            resolve(false);
        });
    });
};

const killPort = async () => {
    try {
        execSync(`for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port} ^| findstr LISTENING') do taskkill /F /PID %a`, { stdio: 'ignore', shell: 'cmd.exe' });
    } catch (e) { }
};

const start = async () => {
    if (engineStatus === 'running' || engineStatus === 'starting') {
        return { success: true };
    }

    if (await checkPort()) {
        sendLog(`Giải phóng port ${port}...`, 'warning');
        await killPort();
        await new Promise(r => setTimeout(r, 1000));
    }

    engineStatus = 'starting';
    sendStatus();
    sendLog(`Khởi động N8N Mini App trên port ${port}...`, 'info');

    const { nodePath, nodeBinDir } = appConfig.getNodePath();
    const env = {
        ...process.env,
        N8N_OPEN_BROWSER: 'false',
        N8N_PORT: port.toString(),
        N8N_USER_FOLDER: appConfig.ENGINE_USER_FOLDER,
        N8N_ENCRYPTION_KEY: process.env.N8N_ENCRYPTION_KEY || 'n8n_miniapp_secret_key_veo3',
        N8N_BLOCK_EXECUTE_COMMAND: 'false',
        N8N_BLOCK_FS_WRITE_ACCESS: 'false',
        NODE_FUNCTION_ALLOW_BUILTIN: 'fs,path,child_process',
        NODE_FUNCTION_ALLOW_EXTERNAL: '*',
        DB_TYPE: 'sqlite',
        DB_SQLITE_DATADIR: appConfig.ENGINE_USER_FOLDER,
        npm_config_cache: appConfig.CACHE_FOLDER,
        npm_config_prefix: appConfig.SYSTEM_PREFIX_FOLDER,
    };

    if (nodeBinDir) {
        const existingPath = process.env.PATH || process.env.Path || '';
        env.PATH = nodeBinDir + ';' + existingPath;
        env.Path = env.PATH;
    }

    const engineBin = path.join(appConfig.SYSTEM_PREFIX_FOLDER, 'node_modules', 'n8n', 'bin', 'n8n');
    const npmCliPath = path.join(nodeBinDir || '', 'node_modules', 'npm', 'bin', 'npm-cli.js');

    const handleLogData = (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) sendLog(line.trim(), 'info');
        });
    };

    if (fs.existsSync(engineBin)) {
        sendLog('Phát hiện n8n core, đang kích hoạt...', 'info');
        engineProcess = spawn(nodePath, [engineBin, 'start'], { env, cwd: appConfig.ENGINE_USER_FOLDER });
    } else {
        sendLog('Cài đặt n8n package lần đầu tiên vào thư mục Mini App (npm install n8n sqlite3)... Vui lòng đợi trong vài phút.\r\n', 'warning');
        const installProcess = spawn(nodePath, [
            npmCliPath, 'install',
            '--prefix', appConfig.SYSTEM_PREFIX_FOLDER,
            '--no-workspaces',
            '--no-package-lock',
            '--loglevel=info', // Force npm to output detailed installation logs
            'n8n@2.14.2',
            'sqlite3@5.1.7'
        ], { env, cwd: appConfig.ENGINE_USER_FOLDER });

        installProcess.stdout.on('data', handleLogData);
        installProcess.stderr.on('data', handleLogData);

        const code = await new Promise((r) => installProcess.on('close', r));
        if (code !== 0 || !fs.existsSync(engineBin)) {
            engineStatus = 'error';
            sendStatus();
            sendLog('Cài đặt n8n thất bại.', 'error');
            return { success: false, error: 'Install failed' };
        }

        sendLog('Cài đặt n8n thành công! Đang kích hoạt máy chủ n8n...', 'info');
        engineProcess = spawn(nodePath, [engineBin, 'start'], { env, cwd: appConfig.ENGINE_USER_FOLDER });
    }

    let isReady = false;
    engineProcess.stdout.on('data', handleLogData);
    engineProcess.stderr.on('data', handleLogData);

    engineProcess.on('close', (code) => {
        engineProcess = null;
        engineStatus = 'stopped';
        sendStatus();
        sendLog(`Tiến trình n8n đã dừng (code ${code})`, 'info');
    });

    // Check port ready (Increase wait attempts to 90 iterations = 3 minutes for first-time SQLite setup)
    sendLog('Đang đợi máy chủ N8N phản hồi trên cổng...', 'info');
    for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 2000));
        if (await checkPort()) {
            isReady = true;
            break;
        }
        if (i > 0 && i % 10 === 0) {
            sendLog(`Vẫn đang kiểm tra kết nối cổng ${port}...`, 'info');
        }
    }

    if (isReady) {
        engineStatus = 'running';
        sendStatus();
        sendLog(`N8N Mini App đã khởi chạy thành công tại http://localhost:${port}`, 'success');
        return { success: true };
    }

    return { success: true, message: 'Process started' };
};

const stop = async () => {
    sendLog('Đang dừng N8N Mini App...', 'warning');
    if (engineProcess) {
        try { execSync(`taskkill /F /T /PID ${engineProcess.pid}`, { stdio: 'ignore' }); } catch (e) { }
        engineProcess = null;
    }
    await killPort();
    engineStatus = 'stopped';
    sendStatus();
    sendLog('N8N Mini App đã dừng hoàn toàn.', 'info');
    return { success: true };
};

if (require.main === module) {
    const cmd = process.argv[2] || 'start';
    if (cmd === 'start') start();
    else if (cmd === 'stop') stop();
}

module.exports = { start, stop, getStatus: () => ({ status: engineStatus, port }), getLogs: () => engineLogs };
